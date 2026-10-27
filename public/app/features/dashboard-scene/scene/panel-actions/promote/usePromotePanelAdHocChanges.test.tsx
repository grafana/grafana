import { act, render, renderHook, screen, userEvent, waitFor } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { SaveDashboardDrawer } from '../../../saving/SaveDashboardDrawer';
import { SaveDashboardForm } from '../../../saving/SaveDashboardForm';
import { dashboardSceneGraph } from '../../../utils/dashboardSceneGraph';
import { DashboardScene } from '../../DashboardScene';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { usePromotePanelAdHocChanges } from './usePromotePanelAdHocChanges';
import { PromotePanelAdHocChangesEvent } from './utils';

// The rebuilt dashboard runs its built-in annotation query, which is not under test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ get: () => new Promise(() => {}) }),
}));
const mockSaveDashboard = jest.fn();
jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [mockSaveDashboard],
}));

const adHocChange = { id: 'organize', options: { excludeByName: { hidden: true } } };
const promotionPath = jest.fn();

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(
      getPanelPlugin({ id: 'table' }).setPanelInteractions({
        interactions: [{ id: 0, name: 'organize', mutates: ['TRANSFORMATION'], schema: [], promotionPath }],
      })
    ),
  getPanelPluginFromCache: () => undefined,
});

async function buildScene({ startEditing = false } = {}) {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'table', title: 'Table' });
  const dashboard = new DashboardScene(
    {
      title: 'My dashboard',
      meta: { canSave: true, canEdit: true },
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    'v2'
  );
  // Loaded dashboards keep the JSON they were built from.
  dashboard.serializer.initialSaveModel = dashboard.getSaveModel();

  // Only the panel needs to be active, to load its plugin and the interactions it declares. Activating the whole tree
  // would also run the annotation layers of the rebuilt dashboard.
  deactivate.push(dashboard.activate(), panel.activate());
  await act(() => new Promise((r) => setTimeout(r, 1)));
  panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, [adHocChange]);
  if (startEditing) {
    act(() => dashboard.onEnterEditMode());
  }

  renderHook(() => usePromotePanelAdHocChanges(dashboard));

  return { panel, dashboard };
}

async function requestPromotion(panel: VizPanel) {
  await act(async () => {
    panel.publishEvent(new PromotePanelAdHocChangesEvent({ panel }), true);
  });
}

async function renderSaveForm(dashboard: DashboardScene) {
  await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
  const drawer = dashboard.state.overlay;
  if (!(drawer instanceof SaveDashboardDrawer)) {
    throw new Error('Expected the save drawer');
  }
  render(<SaveDashboardForm dashboard={dashboard} drawer={drawer} changeInfo={dashboard.getDashboardChanges()} />);
}

async function saveFromDrawer(dashboard: DashboardScene) {
  await renderSaveForm(dashboard);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockSaveDashboard).toHaveBeenCalledTimes(1));
}

async function cancelFromDrawer(dashboard: DashboardScene) {
  await renderSaveForm(dashboard);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(dashboard.state.overlay).toBeUndefined());
}

function getAdHocTransformations(dashboard: DashboardScene) {
  const [currentPanel] = dashboardSceneGraph.getVizPanels(dashboard);
  return currentPanel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);
}

let deactivate: Array<() => void> = [];

describe('usePromotePanelAdHocChanges', () => {
  afterEach(() => {
    deactivate.reverse().forEach((fn) => fn());
    deactivate = [];
  });

  beforeEach(() => {
    promotionPath.mockReset().mockImplementation((dashboard) => ({ ...dashboard, title: 'Promoted' }));
    mockSaveDashboard.mockReset().mockResolvedValue({
      data: { uid: 'dash-1', version: 2, url: '/d/dash-1/promoted', status: 'success' },
    });
  });

  it('passes the v2 dashboard JSON, the panel element key and its ad hoc transformations to the promotion path', async () => {
    const { panel } = await buildScene();

    await requestPromotion(panel);

    expect(promotionPath).toHaveBeenCalledWith(expect.objectContaining({ title: 'My dashboard' }), {
      elementKey: 'panel-1',
      transformations: [adHocChange],
    });
  });

  it('applies the promoted JSON to the dashboard in edit mode and opens the save drawer', async () => {
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);

    expect(dashboard.state.title).toBe('Promoted');
    expect(dashboard.state.isEditing).toBe(true);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
    await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
  });

  it('rebuilds the panel without ad hoc transformations, so the changes are not applied twice', async () => {
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);

    const [rebuiltPanel] = dashboardSceneGraph.getVizPanels(dashboard);
    expect(rebuiltPanel.state.title).toBe('Table');
    expect(rebuiltPanel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual([]);
  });

  it('restores the saved dashboard when the edit is discarded', async () => {
    const { panel, dashboard } = await buildScene();
    await requestPromotion(panel);
    expect(dashboard.state.title).toBe('Promoted');

    act(() => dashboard.exitEditMode({ skipConfirm: true }));

    expect(dashboard.state.title).toBe('My dashboard');
  });

  it('returns to view mode after saving when the user was not editing', async () => {
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);

    await waitFor(() => expect(dashboard.state.isEditing).toBe(false));
    expect(dashboard.state.title).toBe('Promoted');
  });

  it('stays in edit mode after saving when the user was editing', async () => {
    const { panel, dashboard } = await buildScene({ startEditing: true });

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);

    await waitFor(() => expect(dashboard.state.overlay).toBeUndefined());
    expect(dashboard.state.isEditing).toBe(true);
    expect(dashboard.state.isDirty).toBe(false);
  });

  it('takes the promoted changes out and gives them back to the panel as ad hoc changes when cancelled', async () => {
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);
    await cancelFromDrawer(dashboard);

    expect(dashboard.state.isEditing).toBe(false);
    expect(dashboard.state.title).toBe('My dashboard');
    expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);
    expect(mockSaveDashboard).not.toHaveBeenCalled();
  });

  it('undoes only the promotion and stays in edit mode when cancelled while the user was editing', async () => {
    const { panel, dashboard } = await buildScene({ startEditing: true });

    await requestPromotion(panel);
    await cancelFromDrawer(dashboard);

    expect(dashboard.state.isEditing).toBe(true);
    expect(dashboard.state.title).toBe('My dashboard');
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);
  });
});
