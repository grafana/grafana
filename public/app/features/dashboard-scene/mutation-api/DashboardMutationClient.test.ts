import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardMutationClient } from './DashboardMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

function dashboardScene(): DashboardScene {
  return new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });
}

describe('DashboardMutationClient', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('exposes every dashboard command', () => {
    const available = new Set(new DashboardMutationClient(dashboardScene()).getAvailableCommands());

    for (const cmd of DASHBOARD_COMMANDS) {
      expect(available.has(cmd.name)).toBe(true);
    }
  });

  it('also exposes CREATE_NOTEBOOK_SPEC when notebooks are enabled', () => {
    setTestFlags({ [FlagKeys.DashboardNotebooks]: true });

    const available = new DashboardMutationClient(dashboardScene()).getAvailableCommands();

    expect(available).toContain('CREATE_NOTEBOOK_SPEC');
  });

  it('hides CREATE_NOTEBOOK_SPEC when notebooks are off', () => {
    // Refusing the execute is not enough: an agent builds its tool list from this and would offer a
    // create that can only ever fail.
    const available = new DashboardMutationClient(dashboardScene()).getAvailableCommands();

    expect(available).not.toContain('CREATE_NOTEBOOK_SPEC');
  });

  it('exposes no other notebook command', () => {
    setTestFlags({ [FlagKeys.DashboardNotebooks]: true });

    const available = new DashboardMutationClient(dashboardScene()).getAvailableCommands();

    // GET/APPLY_NOTEBOOK_SPEC need an open notebook, so a dashboard must not be able to reach them.
    expect(available).not.toContain('GET_NOTEBOOK_SPEC');
    expect(available).not.toContain('APPLY_NOTEBOOK_SPEC');
  });

  it('names the available commands when asked for one that is not here', async () => {
    const client = new DashboardMutationClient(dashboardScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type: GET_NOTEBOOK_SPEC');
    expect(result.error).toContain('GET_SPEC');
  });

  describe.each([
    { type: 'ENTER_EDIT_MODE', payload: {} },
    { type: 'UPDATE_DASHBOARD_SETTINGS', payload: { title: 'Assistant title' } },
  ])('$type presentation', (command) => {
    beforeEach(() => {
      setTestFlags({ 'grafana.dashboardPreviewMode': true });
    });

    it('enables Preview when the user already entered Edit without choosing a presentation', async () => {
      const scene = dashboardScene();
      scene.onEnterEditMode();
      scene.setState({ title: 'Manual edit' });

      try {
        const result = await new DashboardMutationClient(scene).execute(command);

        expect(result.success).toBe(true);
        expect(scene.state.editPresentation).toBe('preview');
        expect(scene.state.sidebar.state.selectionContext.enabled).toBe(false);

        scene.exitEditMode({ skipConfirm: true, restoreInitialState: true });
        expect(scene.state.title).toBe('Dash');
      } finally {
        if (scene.state.isEditing) {
          scene.exitEditMode({ skipConfirm: true });
        }
      }
    });

    it('preserves the user switching Preview off across repeated Assistant commands', async () => {
      const scene = dashboardScene();
      scene.onEnterEditMode();
      scene.setEditPresentation('preview');
      scene.setEditPresentation('full');

      try {
        const client = new DashboardMutationClient(scene);
        expect((await client.execute(command)).success).toBe(true);
        expect((await client.execute(command)).success).toBe(true);
        expect(scene.state.editPresentation).toBe('full');
        expect(scene.state.sidebar.state.selectionContext.enabled).toBe(true);
      } finally {
        scene.exitEditMode({ skipConfirm: true });
      }
    });
  });

  describe('while a plan preview is active', () => {
    const plan = {
      planId: 'plan-1',
      title: 'Plan',
      layout: 'rows' as const,
      sections: [{ title: 'Section', panels: [{ title: 'Panel', vizType: 'timeseries' }] }],
    };

    let cleanup = () => {};

    afterEach(() => {
      cleanup();
      cleanup = () => {};
    });

    function activeScene() {
      // Unlike dashboardScene() above, no uid: RENDER_PLAN refuses a saved dashboard.
      const scene = new DashboardScene({ title: 'Dash', meta: { canEdit: true } });
      cleanup = scene.activate();
      return scene;
    }

    it('refuses a mutating command', async () => {
      const scene = activeScene();
      const client = new DashboardMutationClient(scene);
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
      expect(scene.state.isEditing).toBeFalsy();
    });

    it('still allows a read-only command', async () => {
      const scene = activeScene();
      const client = new DashboardMutationClient(scene);
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const result = await client.execute({ type: 'GET_DASHBOARD_INFO', payload: {} });

      expect(result.success).toBe(true);
    });

    it('still allows RENDER_PLAN to re-render and END_PLANNING to close the preview', async () => {
      const scene = activeScene();
      const client = new DashboardMutationClient(scene);
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const rerender = await client.execute({
        type: 'RENDER_PLAN',
        payload: { ...plan, planId: 'plan-2', title: 'Replacement' },
      });
      expect(rerender.success).toBe(true);
      expect(scene.state.title).toBe('Replacement');

      const close = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-2' } });
      expect(close.success).toBe(true);
      expect(scene.state.planning).toBeUndefined();
    });

    it('applies planning guards to lowercase lazy commands and allows editing after planning ends', async () => {
      setTestFlags({ [FlagKeys.DashboardNotebooks]: true });
      const scene = activeScene();
      const client = new DashboardMutationClient(scene);
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      expect(scene.isPlanning()).toBe(true);

      const refused = await client.execute({ type: 'create_notebook_spec', payload: {} });
      expect(refused.success).toBe(false);
      expect(refused.error).toContain('read-only');

      const info = await client.execute({ type: 'get_dashboard_info', payload: {} });
      expect(info.success).toBe(true);
      expect(info.data).toMatchObject({ title: 'Plan', uid: '' });

      const rerender = await client.execute({ type: 'render_plan', payload: { ...plan, title: 'Replacement' } });
      expect(rerender.success).toBe(true);
      expect(scene.state.title).toBe('Replacement');

      const close = await client.execute({ type: 'end_planning', payload: { planId: 'plan-1' } });
      expect(close.success).toBe(true);
      expect(scene.state.planning).toBeUndefined();

      const edit = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} });
      expect(edit.success).toBe(true);
      expect(scene.state.isEditing).toBe(true);
    });
  });
});
