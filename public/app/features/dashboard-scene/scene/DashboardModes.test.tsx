import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep } from 'lodash';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService, reportInteraction } from '@grafana/runtime';
import { ConstantVariable, SceneVariableSet, sceneGraph } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { handyTestingSchema } from '@grafana/schema/apis/dashboard.grafana.app/v2/examples';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import {
  createDashboardMutationApi,
  setDashboardMutationClientForTests,
} from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { changeTitle } from '../actions/dashboard/changeTitle';
import { addComposerEnterRequestListener, resetComposerEnterRequestsForTests } from '../composer/composerEntryRequests';
import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { LAZY_DASHBOARD_COMMANDS } from '../mutation-api/commands/lazyRegistry';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { SaveDashboardForm } from '../saving/SaveDashboardForm';
import { useSaveDashboard } from '../saving/useSaveDashboard';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getDashboardResourceText } from '../sidebar/codePaneUtils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { createDeferred } from '../utils/test-utils';

import { DashboardModePicker } from './DashboardModePicker';
import { toggleVizPanelLegend } from './PanelMenuBehavior';
import { dashboardModesEnabled, getDashboardMode, canManuallyEditDashboard } from './dashboardModes';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { addNewRowTo } from './layouts-shared/addNew';
import { Actions } from './new-toolbar/Actions';
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
  // The v2 built-in annotation layer resolves a datasource on activation; never answer.
  getDataSourceSrv: () => ({ get: () => new Promise(() => {}), getInstanceSettings: jest.fn() }),
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

function setup(withPanel = false, isNew = false) {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Original title',
      uid: isNew ? '' : 'modes-test',
      version: isNew ? 0 : 1,
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

function setupV2() {
  const spec = cloneDeep(handyTestingSchema);
  spec.variables = [];
  // Drop the library panel, which would load asynchronously.
  delete spec.elements['panel-2'];
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fixture is a grid layout
  const layout = spec.layout as { spec: { items: Array<{ spec: { element: { name: string } } }> } };
  layout.spec.items = layout.spec.items.filter((item) => item.spec.element.name !== 'panel-2');
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'modes-test', generation: 1, creationTimestamp: '2026-10-23T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;
  const scene = transformSaveModelSchemaV2ToScene(dto);
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

it.each(['panel_menu', 'shortcut', 'navigation'] as const)(
  'opens the panel editor from fullscreen Viewing via %s',
  async (trigger) => {
    const dashboard = setup(true);
    dashboard.setDashboardMode('edit', 'picker');
    dashboard.setDashboardMode('view', 'picker');
    dashboard.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
    expect(dashboard.state.viewPanel).toBe('panel-1');

    if (trigger !== 'navigation') {
      expect(dashboard.setDashboardMode('edit', trigger)).toBe(true);
    }
    dashboard.urlSync?.updateFromUrl({ viewPanel: null, editPanel: '1' });

    await waitFor(() => expect(dashboard.state.editPanel?.state.panelRef.resolve().state.title).toBe('Notes'));
    expect(getDashboardMode(dashboard.state)).toBe('edit');
    expect(dashboard.state.viewPanel).toBeUndefined();
  }
);

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

it('opens the mode picker from the caret and switches the editing policy', async () => {
  const scene = setup();
  render(
    <TestProvider>
      <DashboardModePicker dashboard={scene} />
    </TestProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
  expect(screen.getByRole('menuitemradio', { name: /View/ })).toBeChecked();
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'ViewingView and explore the dashboard.',
    'EditingManually edit panels, layout, and settings.',
  ]);
  expect(screen.getByText('View and explore the dashboard.')).toBeInTheDocument();
  await user.click(screen.getByRole('menuitemradio', { name: /Manually edit panels/ }));
  expect(screen.getByRole('button', { name: 'Change dashboard mode' })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
  expect(screen.getByRole('menuitemradio', { name: /Manually edit panels/ })).toBeChecked();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Change dashboard mode' })).toHaveFocus();
  expect(isFullDashboardEditing(scene.state)).toBe(true);
});

it('switches modes directly from the main button and describes the next mode in its tooltip', async () => {
  const dashboard = setup();
  render(
    <TestProvider>
      <DashboardModePicker dashboard={dashboard} />
    </TestProvider>
  );
  const user = userEvent.setup();
  await user.hover(screen.getByRole('button', { name: 'Dashboard mode: Viewing' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Switch to Editing');
  await user.click(screen.getByRole('button', { name: 'Dashboard mode: Viewing' }));
  expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
  expect(isFullDashboardEditing(dashboard.state)).toBe(true);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.unhover(screen.getByRole('button', { name: 'Dashboard mode: Editing' }));
  await user.hover(screen.getByRole('button', { name: 'Dashboard mode: Editing' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Switch to Viewing');
  await user.click(screen.getByRole('button', { name: 'Dashboard mode: Editing' }));
  expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
  expect(isFullDashboardEditing(dashboard.state)).toBe(false);
  expect(
    jest.mocked(reportInteraction).mock.calls.filter(([event]) => event === 'dashboards_mode_picker_opened')
  ).toEqual([]);
});

describe('switching an unsaved new dashboard to Viewing', () => {
  async function chooseViewing() {
    const dashboard = setup(false, true);
    dashboard.onEnterEditMode();
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    const user = userEvent.setup();
    const editingButton = screen.getByRole('button', { name: 'Dashboard mode: Editing' });
    await user.hover(editingButton);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Save the dashboard before switching to Viewing.');
    await user.click(editingButton);
    await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
    expect(getDashboardMode(dashboard.state)).toBe('edit');
    const drawer = dashboard.state.overlay;
    if (!(drawer instanceof SaveDashboardDrawer)) {
      throw new Error('Expected the save drawer');
    }
    return { dashboard, drawer };
  }

  async function save(dashboard: ReturnType<typeof setup>, drawer: SaveDashboardDrawer, response: unknown) {
    const { result } = renderHook(() => useSaveDashboard(), { wrapper: TestProvider });
    mockSaveDashboard.mockResolvedValue(response);
    await act(async () => {
      const saved = await result.current.onSaveDashboard(dashboard, { isNew: true, saveAsCopy: true });
      if (saved?.status === 'success') {
        drawer.state.onSaveSuccess?.();
      }
    });
  }

  it('opens the save drawer and switches to Viewing after the first successful save', async () => {
    const { dashboard, drawer } = await chooseViewing();
    await save(dashboard, drawer, {
      data: { uid: 'saved-dashboard', version: 1, url: '/d/saved-dashboard', status: 'success' },
    });
    expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
  });

  it('stays in Editing when the first save fails', async () => {
    const { dashboard, drawer } = await chooseViewing();
    await save(dashboard, drawer, { error: { status: 500, data: { message: 'Save failed' } } });
    expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
  });

  it('opens the same save drawer from the Viewing option in the mode menu', async () => {
    const dashboard = setup(false, true);
    dashboard.onEnterEditMode();
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
    await user.click(screen.getByRole('menuitemradio', { name: /Save the dashboard before switching to Viewing/ }));
    await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
    expect(getDashboardMode(dashboard.state)).toBe('edit');
  });

  it.each(['navigation', 'restore'] as const)('refuses Viewing without a save prompt via %s', (trigger) => {
    const dashboard = setup(false, true);
    dashboard.onEnterEditMode();
    expect(dashboard.setDashboardMode('view', trigger)).toBe(false);
    expect(getDashboardMode(dashboard.state)).toBe('edit');
    expect(dashboard.state.overlay).toBeUndefined();
  });
});

describe('switching from Agent editing to Viewing with an unsaved Assistant draft', () => {
  async function chooseViewing() {
    const dashboard = setup();
    await assistantChangesTitle(dashboard, 'Agent draft');
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    const user = userEvent.setup();
    await user.hover(screen.getByRole('button', { name: 'Dashboard mode: Agent editing' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Switch to Viewing');
    await user.click(screen.getByRole('button', { name: 'Dashboard mode: Agent editing' }));
    expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
    expect(getDashboardMode(dashboard.state)).toBe('agent');
    return { dashboard, user };
  }

  it('keeps Agent editing and the draft when the save prompt is cancelled', async () => {
    const { dashboard, user } = await chooseViewing();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Dashboard mode: Agent editing' })).toBeInTheDocument();
    expect(dashboard.state.title).toBe('Agent draft');
    expect(mockSaveDashboard).not.toHaveBeenCalled();
  });

  it('discards the draft and switches to Viewing when Discard is chosen', async () => {
    const { dashboard, user } = await chooseViewing();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
    expect(dashboard.state.title).toBe('Original title');
    expect(isFullDashboardEditing(dashboard.state)).toBe(false);
  });
});

it('asks to save a new dashboard before leaving Agent editing for Viewing', async () => {
  const dashboard = setup(false, true);
  await assistantChangesTitle(dashboard, 'Agent draft');
  render(
    <TestProvider>
      <DashboardModePicker dashboard={dashboard} />
    </TestProvider>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Dashboard mode: Agent editing' }));
  await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
  expect(getDashboardMode(dashboard.state)).toBe('agent');
  expect(dashboard.state.title).toBe('Agent draft');
});

describe('switching from Editing to Viewing with unsaved changes', () => {
  async function chooseViewing(trigger = 'label') {
    const dashboard = setup();
    dashboard.setDashboardMode('edit', 'picker');
    changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Unsaved title' });
    dashboard.setState({ isDirty: true });
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    const user = userEvent.setup();
    if (trigger === 'caret') {
      await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
      await user.click(screen.getByRole('menuitemradio', { name: /View and explore/ }));
    } else {
      await user.click(screen.getByRole('button', { name: 'Dashboard mode: Editing' }));
    }
    expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
    expect(screen.getByText('Do you want to save your changes?')).toBeInTheDocument();
    expect(getDashboardMode(dashboard.state)).toBe('edit');
    expect(dashboard.state.overlay).toBeUndefined();
    return { dashboard, user };
  }

  async function chooseSave({ dashboard, user }: Awaited<ReturnType<typeof chooseViewing>>) {
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
    const drawer = dashboard.state.overlay;
    if (!(drawer instanceof SaveDashboardDrawer)) {
      throw new Error('Expected the save drawer');
    }
    render(
      <TestProvider>
        <SaveDashboardForm dashboard={dashboard} drawer={drawer} changeInfo={dashboard.getDashboardChanges()} />
      </TestProvider>
    );
  }

  it.each(['label', 'caret'])(
    'keeps the draft in Editing when the save prompt from the %s is cancelled',
    async (trigger) => {
      const { dashboard, user } = await chooseViewing(trigger);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
      expect(dashboard.state.title).toBe('Unsaved title');
      expect(dashboard.state.overlay).toBeUndefined();
      expect(mockSaveDashboard).not.toHaveBeenCalled();
    }
  );

  it('discards the draft and switches to Viewing when Discard is chosen', async () => {
    const { dashboard, user } = await chooseViewing();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
    expect(dashboard.state.title).toBe('Original title');
    expect(dashboard.state.isDirty).toBe(false);
    expect(dashboard.state.overlay).toBeUndefined();
    expect(mockSaveDashboard).not.toHaveBeenCalled();
  });

  it('keeps Editing and the draft when the save drawer is cancelled after choosing Save', async () => {
    const { dashboard, user } = await chooseViewing();
    await chooseSave({ dashboard, user });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
    expect(dashboard.state.title).toBe('Unsaved title');
    expect(dashboard.state.overlay).toBeUndefined();
  });

  it('switches to Viewing only after a successful save', async () => {
    const { dashboard, user } = await chooseViewing();
    await chooseSave({ dashboard, user });
    const response = createDeferred();
    mockSaveDashboard.mockReturnValue(response.promise);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mockSaveDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ dashboard: expect.objectContaining({ title: 'Unsaved title' }) })
    );
    expect(getDashboardMode(dashboard.state)).toBe('edit');
    await act(async () => {
      response.resolve({ data: { uid: 'modes-test', version: 2, url: '/d/modes-test', status: 'success' } });
    });
    expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
    expect(dashboard.state.isDirty).toBe(false);
    expect(dashboard.state.title).toBe('Unsaved title');
  });

  it('keeps unsaved changes in Editing when saving fails', async () => {
    const { dashboard, user } = await chooseViewing();
    await chooseSave({ dashboard, user });
    mockSaveDashboard.mockResolvedValue({ error: { status: 500, data: { message: 'Save failed' } } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard mode: Editing' })).toBeInTheDocument();
    expect(dashboard.state.title).toBe('Unsaved title');
    expect(dashboard.state.isDirty).toBe(true);
  });

  it('switches immediately when edits have been reverted', async () => {
    const dashboard = setup();
    dashboard.setDashboardMode('edit', 'picker');
    await dashboard.saveCompleted(dashboard.getSaveModel(), {
      uid: 'modes-test',
      version: 1,
      url: '/d/modes-test',
      status: 'success',
      slug: 'modes-test',
    });
    changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Temporary title' });
    changeTitle({ source: dashboard, oldValue: 'Temporary title', newValue: 'Original title' });
    dashboard.setState({ isDirty: true });
    render(
      <TestProvider>
        <DashboardModePicker dashboard={dashboard} />
      </TestProvider>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dashboard mode: Editing' }));
    expect(screen.getByRole('button', { name: 'Dashboard mode: Viewing' })).toBeInTheDocument();
    expect(dashboard.state.overlay).toBeUndefined();
  });
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

it.each(['view', 'composer'] as const)('lets the legend shortcut toggle the legend in %s mode', (mode) => {
  const scene = setup(true);
  scene.setState({ mode, isEditing: mode === 'composer' });
  const panel = dashboardSceneGraph.getVizPanels(scene)[0];
  panel.setState({ options: { legend: { showLegend: true } } });
  const changeOptions = jest.spyOn(panel, 'onOptionsChange').mockImplementation(() => {});

  toggleVizPanelLegend(panel);

  expect(changeOptions).toHaveBeenCalledWith({ legend: { showLegend: false } });
});

it('lets a plugin-managed dashboard enter Editing and save as a copy', async () => {
  const dashboard = setup();
  dashboard.setState({
    meta: { ...dashboard.state.meta, k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Plugin } } },
  });
  expect(dashboard.managedResourceCannotBeEdited()).toBe(true);
  render(
    <TestProvider>
      <DashboardModePicker dashboard={dashboard} />
    </TestProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Dashboard mode: Viewing' }));
  expect(getDashboardMode(dashboard.state)).toBe('edit');

  cleanup();
  render(
    <TestProvider>
      <SaveDashboard dashboard={dashboard} />
    </TestProvider>
  );
  await user.click(screen.getByRole('button', { name: 'More save options' }));
  expect(screen.getByRole('menuitem', { name: 'Save as copy' })).toBeInTheDocument();
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

it('shows the toolbar Save button in Editing but not in Viewing', () => {
  const dashboard = setup();
  dashboard.setDashboardMode('edit');
  dashboard.setState({ title: 'Unsaved title', isDirty: true });
  render(
    <TestProvider>
      <Actions dashboard={dashboard} />
    </TestProvider>
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

  act(() => dashboard.setDashboardMode('view'));
  expect(dashboard.state.isEditing).toBe(true);
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
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

describe('Assistant edits from Viewing while Composer is on', () => {
  let stopListening = () => {};

  beforeEach(() => {
    setTestFlags({
      dashboardNewLayouts: true,
      'grafana.dashboardPreviewMode': true,
      'grafana.dashboardComposer': true,
    });
  });

  afterEach(() => {
    stopListening();
    stopListening = () => {};
    resetComposerEnterRequestsForTests();
  });

  it('asks Assistant to enter Composer once and stays in Viewing until it does', async () => {
    const listener = jest.fn();
    stopListening = addComposerEnterRequestListener(listener);
    const scene = setup();

    expect((await assistantChangesTitle(scene, 'Assistant draft')).success).toBe(true);
    expect((await assistantChangesTitle(scene, 'Next Assistant draft')).success).toBe(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'modes-test' });
    expect(getDashboardMode(scene.state)).toBe('view');
    expect(scene.state.title).toBe('Next Assistant draft');
    expect(scene.state.isDirty).toBe(true);
  });

  it('switches to Editing when no Assistant listener enters Composer on dashboards', async () => {
    stopListening = addComposerEnterRequestListener(jest.fn(), { resources: ['notebook'] });
    const scene = setup();

    expect((await assistantChangesTitle(scene, 'Assistant draft')).success).toBe(true);

    expect(getDashboardMode(scene.state)).toBe('edit');
  });
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
    await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
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

  it('correlates Assistant entry and actual manual takeover without double counting', async () => {
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

  it.each(['annotation', 'variable'])('ignores unchanged Assistant %s updates until a real edit', async (kind) => {
    const dashboard = setup();
    if (kind === 'variable') {
      dashboard.setState({
        $variables: new SceneVariableSet({ variables: [new ConstantVariable({ name: 'env', value: 'prod' })] }),
      });
    }
    dashboard.onEnterEditMode('assistant');
    const initialResource = getDashboardResourceText(dashboard);
    const client = new DashboardMutationClient(dashboard);
    const update = (changed: boolean) =>
      client.execute(
        kind === 'annotation'
          ? {
              type: 'UPDATE_ANNOTATION',
              payload: {
                name: 'Annotations & Alerts',
                annotation: { spec: { iconColor: changed ? 'red' : 'rgba(0, 211, 255, 1)' } },
              },
            }
          : {
              type: 'UPDATE_VARIABLE',
              payload: {
                name: 'env',
                variable: { kind: 'ConstantVariable', spec: { name: 'env', query: changed ? 'dev' : 'prod' } },
              },
            },
        'grafana-assistant-app'
      );

    expect((await update(false)).success).toBe(true);
    expect(getDashboardResourceText(dashboard)).toBe(initialResource);
    expect(events('dashboards_edit_actor_first_change')).toEqual([]);
    expect(dashboard.getEditSessionTracking().had_assistant_changes).toBe(false);

    expect((await update(true)).success).toBe(true);
    const spec = JSON.parse(getDashboardResourceText(dashboard)).spec;
    if (kind === 'annotation') {
      expect(spec.annotations[0].spec.iconColor).toBe('red');
    } else {
      expect(spec.variables[0].spec.query).toBe('dev');
    }
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ actor: 'assistant', mode: 'agent' }),
    ]);
    expect((await update(true)).success).toBe(true);
    expect(events('dashboards_edit_actor_first_change')).toHaveLength(1);
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

  it('tracks edit periods without reporting mode usage when the mode feature is disabled', () => {
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
    const sessionId = dashboard.getEditSessionTracking().edit_session_id;
    expect(events('dashboards_edit_period_started')).toEqual([
      expect.objectContaining({ source: 'user', edit_session_id: sessionId }),
    ]);
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ edit_session_id: sessionId, actor: 'user', mode: 'edit' }),
    ]);
    expect(dashboard.getEditSessionTracking()).toEqual(
      expect.objectContaining({ had_manual_changes: true, had_assistant_changes: false, edit_actors: 'manual' })
    );
  });

  describe.each([true, false])('edit period outcomes with modes enabled=%s', (enabled) => {
    beforeEach(() => {
      setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': enabled });
    });

    function changeTitleManually(dashboard: ReturnType<typeof setup>, newValue: string) {
      act(() => {
        dashboard.setDashboardMode('edit', 'picker') || dashboard.onEnterEditMode();
        dashboard.activateSidebar();
        changeTitle({ source: dashboard, oldValue: dashboard.state.title, newValue });
        // The change-detection worker is mocked, so mark the draft dirty as it would.
        dashboard.setState({ isDirty: true });
      });
    }

    it.each([
      ['manual', true, false],
      ['assistant', false, true],
      ['mixed', true, true],
    ] as const)('classifies a discarded period as %s', async (actors, manual, assistant) => {
      const dashboard = setup();
      if (assistant) {
        await assistantChangesTitle(dashboard, 'Agent draft');
      }
      if (manual) {
        changeTitleManually(dashboard, 'Manual draft');
      }
      act(() => dashboard.exitEditMode({ skipConfirm: true }));
      expect(events('dashboards_edit_period_ended')).toEqual([
        expect.objectContaining({
          outcome: 'discarded',
          had_manual_changes: manual,
          had_assistant_changes: assistant,
          edit_actors: actors,
        }),
      ]);
    });

    it('reports leaving edit mode without changes as exited with no actors', () => {
      const dashboard = setup();
      act(() => dashboard.onEnterEditMode());
      act(() => dashboard.exitEditMode({ skipConfirm: false }));
      expect(dashboard.state.isEditing).toBe(false);
      expect(events('dashboards_edit_period_ended')).toEqual([
        expect.objectContaining({ outcome: 'exited', edit_actors: 'none', had_unattributed_changes: false }),
      ]);
    });

    it('counts a change no actor recorded as manual', () => {
      const dashboard = setup(true);
      act(() => dashboard.onEnterEditMode());
      act(() => {
        dashboardSceneGraph.getVizPanels(dashboard)[0].setState({ title: 'Dragged elsewhere' });
        dashboard.setState({ isDirty: true });
      });
      expect(dashboard.getEditSessionTracking()).toEqual(
        expect.objectContaining({
          had_manual_changes: false,
          had_assistant_changes: false,
          had_unattributed_changes: true,
          edit_actors: 'manual',
        })
      );
    });

    it('groups panels of a v2 dashboard into a row and records the change', () => {
      const dashboard = setupV2();
      act(() => {
        dashboard.setDashboardMode('edit', 'picker') || dashboard.onEnterEditMode();
        dashboard.activateSidebar();
      });
      act(() => {
        addNewRowTo(dashboard.state.body);
      });
      expect(dashboard.state.body).toBeInstanceOf(RowsLayoutManager);
      expect(dashboard.getEditSessionTracking()).toEqual(expect.objectContaining({ edit_actors: 'manual' }));
    });

    it('reports an open period as abandoned once when the scene deactivates', async () => {
      const dashboard = setup();
      await assistantChangesTitle(dashboard, 'Agent draft');
      deactivate();
      deactivate = () => {};
      window.dispatchEvent(new Event('pagehide'));
      expect(events('dashboards_edit_period_ended')).toEqual([
        expect.objectContaining({ outcome: 'abandoned', edit_actors: 'assistant', has_unsaved_changes: true }),
      ]);
    });

    it('reports an open period as abandoned when the page is hidden', () => {
      const dashboard = setup();
      changeTitleManually(dashboard, 'Manual draft');
      window.dispatchEvent(new Event('pagehide'));
      expect(events('dashboards_edit_period_ended')).toEqual([
        expect.objectContaining({ outcome: 'abandoned', edit_actors: 'manual' }),
      ]);
    });
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

  it.each([false, true])('reports the same start and discard events with modes enabled=%s', async (enabled) => {
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
    expect(events('dashboards_edit_period_started')).toHaveLength(3);
    expect(events('dashboards_edit_period_ended')).toEqual([
      expect.objectContaining({ outcome: 'saved' }),
      expect.objectContaining({ outcome: 'discarded' }),
      expect.objectContaining({ outcome: 'discarded' }),
    ]);
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

describe('actor attribution during Assistant requests', () => {
  const events = (name: string) =>
    jest
      .mocked(reportInteraction)
      .mock.calls.filter(([event]) => event === name)
      .map(([, payload]) => payload);

  it.each(['GET_SPEC', 'UPDATE_DASHBOARD_SETTINGS'])(
    'attributes a manual change to the user while Assistant %s loads',
    async (type) => {
      const dashboard = setup();
      dashboard.setDashboardMode('edit', 'picker');
      const command = LAZY_DASHBOARD_COMMANDS.find((command) => command.name === type)!;
      const load = command.load;
      const loaded = createDeferred<void>();
      const loadSpy = jest.spyOn(command, 'load').mockImplementation(async () => {
        await loaded.promise;
        return load();
      });
      const pending = new DashboardMutationClient(dashboard).execute(
        { type, payload: type === 'GET_SPEC' ? {} : { title: 'Assistant title' } },
        'grafana-assistant-app'
      );
      try {
        changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Manual title' });
        expect(dashboard.state.title).toBe('Manual title');
        expect(dashboard.getEditSessionTracking()).toMatchObject({
          had_manual_changes: true,
          had_assistant_changes: false,
        });
      } finally {
        loaded.resolve();
        await pending;
        loadSpy.mockRestore();
      }
      expect(events('dashboards_edit_actor_first_change')).toEqual(
        type === 'GET_SPEC'
          ? [expect.objectContaining({ actor: 'user' })]
          : [expect.objectContaining({ actor: 'user' }), expect.objectContaining({ actor: 'assistant' })]
      );
    }
  );

  it('attributes manual takeover while an Assistant panel update awaits plugin loading', async () => {
    const dashboard = setup(true);
    const loading = createDeferred<void>();
    const loaded = createDeferred<void>();
    const changePlugin = jest.spyOn(dashboard, 'changePanelPlugin').mockImplementation(async (panel, pluginId) => {
      loading.resolve();
      await loaded.promise;
      panel.setState({ pluginId });
    });
    const pending = new DashboardMutationClient(dashboard).execute(
      {
        type: 'UPDATE_PANEL',
        payload: { element: { name: 'panel-1' }, panel: { spec: { vizConfig: { group: 'timeseries' } } } },
      },
      'grafana-assistant-app'
    );
    await loading.promise;
    try {
      changeTitle({ source: dashboard, oldValue: 'Original title', newValue: 'Manual title' });
      expect(getDashboardMode(dashboard.state)).toBe('edit');
      expect(dashboard.getEditSessionTracking()).toMatchObject({
        had_manual_changes: true,
        had_assistant_changes: false,
      });
    } finally {
      loaded.resolve();
      await pending;
      changePlugin.mockRestore();
    }
    expect(events('dashboards_edit_actor_first_change')).toEqual([
      expect.objectContaining({ actor: 'user', mode: 'edit' }),
      expect.objectContaining({ actor: 'assistant', mode: 'edit' }),
    ]);
  });
});
