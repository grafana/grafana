import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService, reportInteraction } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  createDashboardMutationApi,
  setDashboardMutationClientForTests,
} from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { changeTitle } from '../actions/dashboard/changeTitle';
import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { setDashboardModeAfterSave, consumeDashboardModeAfterSave } from '../saving/dashboardModeAfterSave';
import { useSaveDashboard } from '../saving/useSaveDashboard';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getDashboardResourceText } from '../sidebar/codePaneUtils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { DashboardModePicker } from './DashboardModePicker';
import { toggleVizPanelLegend } from './PanelMenuBehavior';
import { dashboardModesEnabled, getDashboardMode, canManuallyEditDashboard } from './dashboardModes';
import { SaveDashboard } from './new-toolbar/actions/SaveDashboard';
import { isFullDashboardEditing } from './types/dashboard';

const mockSaveDashboard = jest.fn();

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [mockSaveDashboard],
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};

beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
  mockSaveDashboard.mockReset();
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
  locationService.replace('/d/modes-test');
});

afterEach(() => {
  cleanup();
  setDashboardMutationClientForTests(null);
  deactivate();
  deactivate = () => {};
  setTestFlags({});
});

function setup(withPanel = false) {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Original title',
      uid: 'modes-test',
      version: 1,
      schemaVersion: 39,
      panels: withPanel
        ? [
            {
              id: 1,
              type: 'text',
              title: 'Notes',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              options: { mode: 'markdown', content: 'Keep this text' },
              fieldConfig: { defaults: {}, overrides: [] },
            },
          ]
        : [],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  return scene;
}

it.each([
  [false, false, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
])('gates modes with layouts=%s and preview=%s', (layouts, preview, expected) => {
  setTestFlags({ dashboardNewLayouts: layouts, 'grafana.dashboardPreviewMode': preview });
  expect(dashboardModesEnabled()).toBe(expected);
});

it('keeps the draft and history when switching modes without additional edits', () => {
  const scene = setup();
  expect(getDashboardMode(scene.state)).toBe('view');
  scene.setDashboardMode('edit');
  const resource = JSON.parse(getDashboardResourceText(scene));
  resource.spec.title = 'Visual edit';
  applyDashboardSpec({ scene, spec: resource.spec, description: 'Change title', scope: 'dashboard' });
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  const baseline = scene.getInitialState()?.title;
  scene.setDashboardMode('view');
  expect(isFullDashboardEditing(scene.state)).toBe(false);
  expect(scene.state.isEditing).toBe(true);
  scene.setDashboardMode('edit');
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  expect(scene.getInitialState()?.title).toBe(baseline);
});

it('accepts Assistant writes in View and refuses generic plugin writes', async () => {
  const scene = setup();
  const client = new DashboardMutationClient(scene);
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Assistant title';
  const mutation = { type: 'APPLY_SPEC', payload: { spec, validate: true } };
  expect((await client.execute(mutation, 'another-app')).success).toBe(false);
  expect(scene.state.title).toBe('Original title');
  expect((await client.execute(mutation, 'grafana-assistant-app')).success).toBe(true);
  expect(scene.state.title).toBe('Assistant title');
  expect(getDashboardMode(scene.state)).toBe('agent');
  expect((await client.execute(mutation, 'another-app')).success).toBe(false);
  expect(canManuallyEditDashboard(scene.state)).toBe(false);
  expect((await client.execute({ type: 'GET_SPEC', payload: {} }, 'another-app')).success).toBe(true);
});

it('refuses Assistant writes without edit permission', async () => {
  const scene = setup();
  scene.setState({ meta: { canEdit: false, canSave: false } });
  const result = await new DashboardMutationClient(scene).execute(
    {
      type: 'APPLY_SPEC',
      payload: { spec: JSON.parse(getDashboardResourceText(scene)).spec },
    },
    'grafana-assistant-app'
  );
  expect(result.success).toBe(false);
  expect(scene.state.title).toBe('Original title');
});

it('blocks direct edit actions and settings from View', () => {
  const scene = setup();
  scene.setDashboardMode('edit');
  scene.setDashboardMode('view');
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Hidden action';
  applyDashboardSpec({ scene, spec, description: 'Manual change', scope: 'dashboard' });
  scene.onOpenSettings();
  expect(scene.state.title).toBe('Original title');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(0);
  expect(getDashboardMode(scene.state)).toBe('view');
});

it.each(['label', 'caret'])('opens the mode picker from the %s and switches the editing policy', async (trigger) => {
  const scene = setup();
  render(
    <TestProvider>
      <DashboardModePicker dashboard={scene} />
    </TestProvider>
  );
  const user = userEvent.setup();
  const buttonName = (mode: string) => (trigger === 'label' ? `Dashboard mode: ${mode}` : 'Change dashboard mode');
  await user.click(screen.getByRole('button', { name: buttonName('Viewing') }));
  expect(screen.getByRole('menuitemradio', { name: /View/ })).toBeChecked();
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'ViewingView and explore the dashboard.',
    'EditingManually edit panels, layout, and settings.',
  ]);
  expect(screen.getByText('View and explore the dashboard.')).toBeInTheDocument();
  await user.click(screen.getByRole('menuitemradio', { name: /Manually edit panels/ }));
  expect(screen.getByRole('button', { name: buttonName('Editing') })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: buttonName('Editing') }));
  expect(screen.getByRole('menuitemradio', { name: /Manually edit panels/ })).toBeChecked();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: buttonName('Editing') })).toHaveFocus();
  expect(isFullDashboardEditing(scene.state)).toBe(true);
});

it.each(['view', 'edit', 'agent'] as const)('hands off %s once after first save or copy', (mode) => {
  setDashboardModeAfterSave('new-uid', mode);
  expect(consumeDashboardModeAfterSave('new-uid')).toBe(mode);
  expect(consumeDashboardModeAfterSave('new-uid')).toBeUndefined();
});

it('binds View mutation permission to the host-provided plugin identity', async () => {
  const scene = setup();
  setDashboardMutationClientForTests(new DashboardMutationClient(scene));
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Assistant edit in View';
  const mutation = { type: 'APPLY_SPEC', payload: { spec } };
  const untrusted = await createDashboardMutationApi('other-app').execute(mutation);
  expect(untrusted.success).toBe(false);
  expect(scene.state.title).toBe('Original title');
  const assistant = await createDashboardMutationApi('grafana-assistant-app').execute(mutation);
  expect(assistant.success).toBe(true);
  expect(scene.state.title).toBe('Assistant edit in View');
  expect(getDashboardMode(scene.state)).toBe('agent');
});

it('blocks the legend shortcut from changing panel options in View', () => {
  const scene = setup(true);
  const panel = dashboardSceneGraph.getVizPanels(scene)[0];
  panel.setState({ options: { legend: { showLegend: true } } });
  const changeOptions = jest.spyOn(panel, 'onOptionsChange').mockImplementation(() => {});
  toggleVizPanelLegend(panel);
  expect(changeOptions).not.toHaveBeenCalled();
  expect(panel.state.options).toEqual({ legend: { showLegend: true } });
  scene.setDashboardMode('edit');
  toggleVizPanelLegend(panel);
  expect(changeOptions).toHaveBeenCalledWith({ legend: { showLegend: false } });
});

it('discards changes while preserving Viewing mode', () => {
  const scene = setup();
  scene.setDashboardMode('edit');
  scene.setState({ title: 'Unsaved title' });
  scene.setDashboardMode('view');
  scene.discardChangesAndKeepEditing();
  expect(scene.state.title).toBe('Original title');
  expect(getDashboardMode(scene.state)).toBe('view');
  expect(scene.state.isDirty).toBe(false);
});

it('opens Changes in the existing save drawer without dropping save options', async () => {
  const dashboard = setup();
  dashboard.setDashboardMode('edit');
  await act(() => dashboard.openSaveDrawer({ saveAsCopy: true }));
  const drawer = dashboard.state.overlay;
  if (!(drawer instanceof SaveDashboardDrawer)) {
    throw new Error('Expected a save drawer');
  }
  act(() => dashboard.setDashboardMode('view'));
  render(
    <TestProvider>
      <SaveDashboard dashboard={dashboard} />
    </TestProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'More save options' }));
  await user.click(screen.getByRole('menuitem', { name: 'View changes' }));
  expect(dashboard.state.overlay === drawer).toBe(true);
  expect(drawer.state.showDiff).toBe(true);
  expect(drawer.state.saveAsCopy).toBe(true);
});

it.each([false, true])('keeps legacy dashboards in full editing for Assistant (preview flag: %s)', (enabled) => {
  setTestFlags({ dashboardNewLayouts: false, 'grafana.dashboardPreviewMode': enabled });
  const dashboard = setup();
  dashboard.onEnterEditMode('assistant');
  expect(isFullDashboardEditing(dashboard.state)).toBe(true);
  expect(dashboard.state.mode).toBeUndefined();
});

async function assistantChangesTitle(scene: ReturnType<typeof setup>, title: string) {
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = title;
  return new DashboardMutationClient(scene).execute(
    { type: 'APPLY_SPEC', payload: { spec, validate: true } },
    'grafana-assistant-app'
  );
}

it('labels Assistant edits from Viewing as Agent editing without adding a picker option', async () => {
  const scene = setup();
  render(
    <TestProvider>
      <DashboardModePicker dashboard={scene} />
    </TestProvider>
  );
  await act(async () => {
    expect((await assistantChangesTitle(scene, 'Agent draft')).success).toBe(true);
  });
  expect(screen.getByRole('button', { name: 'Dashboard mode: Agent editing' })).toBeInTheDocument();
  expect(scene.state.title).toBe('Agent draft');
  expect(isFullDashboardEditing(scene.state)).toBe(false);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
  expect(screen.queryByRole('menuitemradio', { name: /Agent editing/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('menuitemradio', { name: /Manually edit panels/ }));
  expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
  await act(async () => {
    expect((await assistantChangesTitle(scene, 'Later Agent draft')).success).toBe(true);
  });
  expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
});

it('hands Agent editing to the user on a manual change and preserves the undo history', async () => {
  const scene = setup();
  expect((await assistantChangesTitle(scene, 'Agent draft')).success).toBe(true);
  changeTitle({ source: scene, oldValue: 'Agent draft', newValue: 'Manual draft' });
  expect(scene.state.title).toBe('Manual draft');
  expect(getDashboardMode(scene.state)).toBe('edit');
  expect(isFullDashboardEditing(scene.state)).toBe(true);
  expect((await assistantChangesTitle(scene, 'Later Agent draft')).success).toBe(true);
  expect(getDashboardMode(scene.state)).toBe('edit');
  scene.state.sidebar.undoAction();
  expect(scene.state.title).toBe('Manual draft');
  scene.state.sidebar.undoAction();
  expect(scene.state.title).toBe('Agent draft');
});

it('keeps Viewing for Assistant reads and rejected writes', async () => {
  const scene = setup();
  const client = new DashboardMutationClient(scene);
  expect((await client.execute({ type: 'GET_SPEC', payload: {} }, 'grafana-assistant-app')).success).toBe(true);
  expect(getDashboardMode(scene.state)).toBe('view');
  scene.setState({ meta: { canEdit: false } });
  expect((await assistantChangesTitle(scene, 'Denied')).success).toBe(false);
  expect(scene.state.title).toBe('Original title');
  expect(getDashboardMode(scene.state)).toBe('view');
});

it('can return to Viewing and lets a new Assistant edit start Agent editing again', async () => {
  const scene = setup();
  scene.setDashboardMode('edit');
  expect((await assistantChangesTitle(scene, 'Assistant in Editing')).success).toBe(true);
  expect(getDashboardMode(scene.state)).toBe('edit');
  scene.setDashboardMode('view');
  expect((await assistantChangesTitle(scene, 'Agent from Viewing')).success).toBe(true);
  expect(getDashboardMode(scene.state)).toBe('agent');
  scene.setDashboardMode('view');
  expect(getDashboardMode(scene.state)).toBe('view');
  expect(scene.state.title).toBe('Agent from Viewing');
});

describe('mode instrumentation', () => {
  function events(name: string) {
    return jest
      .mocked(reportInteraction)
      .mock.calls.filter(([event]) => event === name)
      .map(([, properties]) => properties);
  }

  it('counts one picker exposure across remounts and reports each menu opening', async () => {
    const dashboard = setup();
    const user = userEvent.setup();
    const first = render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Dashboard mode: Viewing' }));
    await user.click(screen.getByRole('menuitemradio', { name: /Editing/ }));
    first.unmount();
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
    expect(events('dashboards_mode_picker_shown')).toEqual([
      expect.objectContaining({ dashboard_uid: 'modes-test', mode: 'view' }),
    ]);
    expect(events('dashboards_mode_picker_opened')).toEqual([
      expect.objectContaining({ mode: 'view', first_open: true }),
      expect.objectContaining({ mode: 'edit', edit_session_id: expect.any(String), first_open: false }),
    ]);
    expect(events('dashboards_mode_changed')).toEqual([
      expect.objectContaining({ previous_mode: 'view', mode: 'edit', trigger: 'picker', has_unsaved_changes: false }),
    ]);
  });

  it('correlates Assistant entry, review, and actual manual takeover without double counting', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    const session = dashboard.getEditSessionTracking();
    expect(session).toEqual(
      expect.objectContaining({
        edit_session_id: expect.any(String),
        edit_source: 'assistant',
        had_assistant_changes: true,
        had_manual_changes: false,
      })
    );
    dashboard.setDashboardMode('view', 'picker');
    dashboard.setDashboardMode('view', 'picker');
    await assistantChangesTitle(dashboard, 'Next agent draft');
    changeTitle({ source: dashboard, oldValue: 'Next agent draft', newValue: 'Manual draft' });
    expect(events('dashboards_mode_changed')).toEqual([
      expect.objectContaining({
        previous_mode: 'view',
        mode: 'agent',
        trigger: 'assistant',
        edit_session_id: session.edit_session_id,
      }),
      expect.objectContaining({
        previous_mode: 'agent',
        mode: 'view',
        trigger: 'picker',
        has_unsaved_changes: true,
        edit_session_id: session.edit_session_id,
      }),
      expect.objectContaining({
        previous_mode: 'view',
        mode: 'agent',
        trigger: 'assistant',
        edit_session_id: session.edit_session_id,
      }),
      expect.objectContaining({
        previous_mode: 'agent',
        mode: 'edit',
        trigger: 'manual_change',
        edit_session_id: session.edit_session_id,
      }),
    ]);
    expect(events('dashboards_edit_period_started')).toEqual([
      expect.objectContaining({ source: 'assistant', edit_session_id: session.edit_session_id }),
    ]);
    expect(dashboard.getEditSessionTracking()).toEqual(
      expect.objectContaining({ had_manual_changes: true, had_assistant_changes: true })
    );
  });

  it.each(['view', 'edit'] as const)('reports each actor’s first change once, starting in %s', async (initialMode) => {
    const dashboard = setup();
    dashboard.setDashboardMode(initialMode, 'picker');
    const client = new DashboardMutationClient(dashboard);
    expect((await client.execute({ type: 'GET_SPEC', payload: {} }, 'grafana-assistant-app')).success).toBe(true);
    expect(
      (
        await client.execute(
          { type: 'UPDATE_DASHBOARD_SETTINGS', payload: { title: 'Original title' } },
          'grafana-assistant-app'
        )
      ).success
    ).toBe(true);
    expect(events('dashboards_edit_actor_first_change')).toEqual([]);

    await assistantChangesTitle(dashboard, 'Agent draft');
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    expect(sessionId).toEqual(expect.any(String));
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({
        edit_session_id: sessionId,
        actor: 'assistant',
        mode: initialMode === 'view' ? 'agent' : 'edit',
      }),
    ]);

    dashboard.setDashboardMode('edit', 'picker');
    changeTitle({ source: dashboard, oldValue: 'Agent draft', newValue: 'Agent draft' });
    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });
    expect(events('dashboards_edit_actor_first_change')).toHaveLength(1);
    changeTitle({ source: dashboard, oldValue: 'Agent draft', newValue: 'Manual draft' });
    dashboard.state.sidebar.undoAction();
    await assistantChangesTitle(dashboard, 'Another agent draft');
    dashboard.getEditSessionTracking();
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, actor: 'assistant' }),
      expect.objectContaining({ edit_session_id: sessionId, actor: 'user', mode: 'edit' }),
    ]);
  });

  it('reports the first Assistant panel update before the later manual mode switch', async () => {
    const dashboard = setup(true);
    const client = new DashboardMutationClient(dashboard);
    const update = (title: string) =>
      client.execute(
        { type: 'UPDATE_PANEL', payload: { element: { name: 'panel-1' }, panel: { spec: { title } } } },
        'grafana-assistant-app'
      );

    expect((await update('Notes')).success).toBe(true);
    expect(events('dashboards_edit_actor_first_change')).toEqual([]);
    expect((await update('Assistant notes')).success).toBe(true);
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    expect(dashboard.state.body.getVizPanels()[0].state.title).toBe('Assistant notes');
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, actor: 'assistant', mode: 'agent' }),
    ]);
    expect((await update('More assistant notes')).success).toBe(true);
    dashboard.setDashboardMode('edit', 'picker');
    changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Manual title' });
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, actor: 'assistant', mode: 'agent' }),
      expect.objectContaining({ edit_session_id: sessionId, actor: 'user', mode: 'edit' }),
    ]);
  });

  it('reports Assistant entry after manually entering Editing and returning to Viewing', async () => {
    const dashboard = setup();
    dashboard.setDashboardMode('edit', 'picker');
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    dashboard.setDashboardMode('view', 'picker');

    const client = new DashboardMutationClient(dashboard);
    const result = await client.execute({ type: 'ENTER_EDIT_MODE', payload: {} }, 'grafana-assistant-app');
    expect(result.success).toBe(true);
    expect(getDashboardMode(dashboard.state)).toBe('agent');
    expect(events('dashboards_mode_changed')).toEqual([
      expect.objectContaining({ previous_mode: 'view', mode: 'edit', trigger: 'picker' }),
      expect.objectContaining({ previous_mode: 'edit', mode: 'view', trigger: 'picker' }),
      expect.objectContaining({
        previous_mode: 'view',
        mode: 'agent',
        trigger: 'assistant',
        edit_session_id: sessionId,
        has_unsaved_changes: false,
      }),
    ]);
  });

  it('does not count entering Editing or a no-op action as a manual mutation', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    dashboard.setDashboardMode('edit', 'picker');
    changeTitle({ source: dashboard, oldValue: 'Agent draft', newValue: 'Agent draft' });
    expect(dashboard.getEditSessionTracking()).toEqual(
      expect.objectContaining({ had_manual_changes: false, had_assistant_changes: true })
    );
    expect(events('dashboards_mode_changed')).toHaveLength(2);
  });

  it('does not report rejected transitions or save-handoff restoration as user activity', () => {
    const dashboard = setup();
    dashboard.setState({ meta: { canEdit: false } });
    expect(dashboard.setDashboardMode('edit', 'picker')).toBe(false);
    dashboard.setState({ meta: { canEdit: true } });
    expect(dashboard.setDashboardMode('agent', 'restore')).toBe(true);
    expect(getDashboardMode(dashboard.state)).toBe('agent');
    expect(events('dashboards_mode_changed')).toEqual([]);
    expect(events('dashboards_edit_period_started')).toEqual([]);
    changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'After restore' });
    expect(events('dashboards_edit_period_started')).toEqual([
      expect.objectContaining({ source: 'user', edit_session_id: expect.any(String) }),
    ]);
  });

  it.each([false, true])(
    'correlates successful save (copy=%s) and begins a new period on the next change',
    async (copy) => {
      const dashboard = setup();
      await assistantChangesTitle(dashboard, 'Agent draft');
      const session = dashboard.getEditSessionTracking();
      mockSaveDashboard.mockResolvedValue({
        data: { uid: 'modes-test', version: 2, url: '/d/modes-test', slug: 'modes-test' },
      });
      const { result } = renderHook(() => useSaveDashboard(copy), { wrapper: TestProvider });
      await act(async () => {
        await result.current.onSaveDashboard(dashboard, { saveAsCopy: copy });
      });
      expect(events(copy ? 'grafana_dashboard_copied' : 'grafana_dashboard_saved')).toEqual([
        expect.objectContaining({
          edit_session_id: session.edit_session_id,
          edit_source: 'assistant',
          mode: 'agent',
          had_assistant_changes: true,
          had_manual_changes: false,
        }),
      ]);
      expect(events('dashboards_edit_period_ended')).toEqual([
        expect.objectContaining({
          edit_session_id: session.edit_session_id,
          outcome: copy ? 'saved_as_copy' : 'saved',
          edit_source: 'assistant',
          mode: 'agent',
          had_assistant_changes: true,
          had_manual_changes: false,
          elapsed_ms: expect.any(Number),
        }),
      ]);
      expect(dashboard.getEditSessionTracking()).toEqual({});
      await assistantChangesTitle(dashboard, 'After save');
      const next = dashboard.getEditSessionTracking();
      expect(next.edit_session_id).toEqual(expect.any(String));
      expect(next.edit_session_id).not.toBe(session.edit_session_id);
      expect(next.had_assistant_changes).toBe(true);
      expect(events('dashboards_edit_actor_first_change')).toEqual([
        expect.objectContaining({ edit_session_id: session.edit_session_id, actor: 'assistant' }),
        expect.objectContaining({ edit_session_id: next.edit_session_id, actor: 'assistant' }),
      ]);
    }
  );

  it('attributes a save to the mode at submission, not a switch during the request', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    let completeSave = () => {};
    mockSaveDashboard.mockReturnValue(
      new Promise((resolve) => {
        completeSave = () =>
          resolve({ data: { uid: 'modes-test', version: 2, url: '/d/modes-test', slug: 'modes-test' } });
      })
    );
    const { result } = renderHook(() => useSaveDashboard(), { wrapper: TestProvider });
    await act(async () => {
      const pendingSave = result.current.onSaveDashboard(dashboard, {});
      dashboard.setDashboardMode('edit', 'picker');
      completeSave();
      await pendingSave;
    });
    expect(events('grafana_dashboard_saved')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, mode: 'agent', had_manual_changes: false }),
    ]);
    expect(events('dashboards_edit_period_ended')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, outcome: 'saved', mode: 'agent' }),
    ]);
    expect(getDashboardMode(dashboard.state)).toBe('edit');
  });

  it('keeps the session after failed save and correlates explicit discard', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    const session = dashboard.getEditSessionTracking();
    mockSaveDashboard.mockResolvedValue({ error: { status: 500, data: { message: 'Save failed' } } });
    const { result } = renderHook(() => useSaveDashboard(), { wrapper: TestProvider });
    await act(async () => {
      await result.current.onSaveDashboard(dashboard, {});
    });
    expect(dashboard.getEditSessionTracking().edit_session_id).toBe(session.edit_session_id);
    expect(events('grafana_dashboard_saved')).toEqual([]);
    expect(events('dashboards_edit_period_ended')).toEqual([]);
    await assistantChangesTitle(dashboard, 'After failed save');
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: session.edit_session_id, actor: 'assistant' }),
    ]);
    dashboard.discardChangesAndKeepEditing();
    expect(events('dashboards_edit_period_ended')).toEqual([
      expect.objectContaining({
        edit_session_id: session.edit_session_id,
        mode: 'agent',
        has_unsaved_changes: true,
        had_assistant_changes: true,
        outcome: 'discarded',
      }),
    ]);
    expect(dashboard.state.title).toBe('Original title');
    expect(events('dashboards_edit_discarded')).toEqual([]);
    expect(dashboard.getEditSessionTracking()).toEqual({});
    await assistantChangesTitle(dashboard, 'After discard');
    const nextSessionId = dashboard.getEditSessionTracking().edit_session_id;
    expect(nextSessionId).toEqual(expect.any(String));
    expect(nextSessionId).not.toBe(session.edit_session_id);
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: session.edit_session_id, actor: 'assistant' }),
      expect.objectContaining({ edit_session_id: nextSessionId, actor: 'assistant' }),
    ]);
  });

  it('does not attribute time-range filtering to manual editing', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });
    expect(dashboard.getEditSessionTracking()).toEqual(
      expect.objectContaining({ had_manual_changes: false, had_assistant_changes: true })
    );
  });

  it('attributes general settings edits after Assistant changes and after a save', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    dashboard.setDashboardMode('edit', 'picker');
    dashboard.setState({ description: 'Manual description' });
    const first = dashboard.getEditSessionTracking();
    expect(first).toEqual(expect.objectContaining({ had_manual_changes: true, had_assistant_changes: true }));
    await dashboard.saveCompleted(dashboard.getSaveModel(), {
      uid: 'modes-test',
      version: 2,
      url: '/d/modes-test',
      slug: 'modes-test',
      status: 'success',
    });
    dashboard.setState({ description: 'Another manual description' });
    const next = dashboard.getEditSessionTracking();
    expect(next).toEqual(
      expect.objectContaining({ edit_source: 'user', had_manual_changes: true, had_assistant_changes: false })
    );
    expect(next.edit_session_id).not.toBe(first.edit_session_id);
  });

  it('keeps legacy tracking unchanged when the mode feature is disabled', () => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': false });
    const dashboard = setup();
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    act(() => dashboard.onEnterEditMode());
    expect(events('dashboards_edit_session_started')).toEqual([
      expect.objectContaining({ dashboard_uid: 'modes-test', source: 'user' }),
    ]);
    expect(events('dashboards_edit_session_started')[0]).not.toHaveProperty('edit_session_id');
    expect(events('dashboards_mode_picker_shown')).toEqual([]);
    expect(events('dashboards_mode_changed')).toEqual([]);
    act(() => {
      dashboard.activateSidebar();
      changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Legacy edit' });
    });
    expect(dashboard.state.title).toBe('Legacy edit');
    expect(events('dashboards_edit_actor_first_change')).toEqual([]);
    expect(dashboard.getEditSessionTracking()).toEqual({});
  });

  it('includes the session when discarding and exiting edit mode', async () => {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    dashboard.exitEditMode({ skipConfirm: true });
    expect(dashboard.state.title).toBe('Original title');
    expect(events('dashboards_edit_period_ended')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, had_assistant_changes: true, outcome: 'discarded' }),
    ]);
    expect(dashboard.getEditSessionTracking()).toEqual({});
  });

  it.each([false, true])('preserves legacy start and discard behavior with modes enabled=%s', async (enabled) => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': enabled });
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'First draft');
    mockSaveDashboard.mockResolvedValue({
      data: { uid: 'modes-test', version: 2, url: '/d/modes-test', slug: 'modes-test' },
    });
    const { result } = renderHook(() => useSaveDashboard(), { wrapper: TestProvider });
    await act(async () => {
      await result.current.onSaveDashboard(dashboard, {});
    });
    await assistantChangesTitle(dashboard, 'Second draft');
    dashboard.discardChangesAndKeepEditing();
    expect(dashboard.state.title).toBe('First draft');
    expect(dashboard.state.isEditing).toBe(true);
    expect(events('dashboards_edit_discarded')).toEqual([]);
    await assistantChangesTitle(dashboard, 'Third draft');
    act(() => dashboard.exitEditMode({ skipConfirm: true }));
    expect(dashboard.state.isEditing).toBe(false);
    expect(events('dashboards_edit_session_started')).toEqual([
      { dashboard_uid: 'modes-test', source: 'assistant', isDynamicDashboard: true },
    ]);
    expect(events('dashboards_edit_discarded')).toEqual([{ isDynamicDashboard: true }]);
    expect(events('grafana_dashboard_saved')).toHaveLength(1);
    expect(events('dashboards_edit_period_started')).toHaveLength(enabled ? 3 : 0);
    expect(events('dashboards_edit_period_ended')).toEqual(
      enabled
        ? [
            expect.objectContaining({ outcome: 'saved' }),
            expect.objectContaining({ outcome: 'discarded' }),
            expect.objectContaining({ outcome: 'discarded' }),
          ]
        : []
    );
  });

  it('reports elapsed time as wall time rather than inventing active editing time', () => {
    const clock = jest.spyOn(performance, 'now').mockReturnValue(1000);
    const dashboard = setup();
    dashboard.setDashboardMode('edit', 'picker');
    clock.mockReturnValue(2500);
    expect(dashboard.getEditSessionTracking().elapsed_ms).toBe(1500);
    clock.mockRestore();
  });
});
