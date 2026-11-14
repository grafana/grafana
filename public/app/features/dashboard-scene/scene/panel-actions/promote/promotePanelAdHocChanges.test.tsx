import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import {
  type DataSourceFallbackWatcher,
  seedDataSources,
  watchDataSourceFallbacks,
} from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { setMobileViewport } from 'app/features/dashboard-scene/utils/mobileViewportTestUtils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';
import { plugin as tablePlugin } from 'app/plugins/panel/table/module';

import { changeTitle } from '../../../actions/dashboard/changeTitle';
import { buildPanelEditScene } from '../../../panel-edit/PanelEditor';
import { SaveDashboardDrawer } from '../../../saving/SaveDashboardDrawer';
import { SaveDashboardForm } from '../../../saving/SaveDashboardForm';
import { dashboardSceneGraph } from '../../../utils/dashboardSceneGraph';
import { DashboardScene } from '../../DashboardScene';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { PromotePanelAdHocChangesEvent } from './utils';

const annotationDataSource = new MockDataSourceApi('-- Grafana --');
annotationDataSource.annotations = {};

const mockSaveDashboard = jest.fn();
jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [mockSaveDashboard],
}));

const adHocChange = { id: 'organize', options: { excludeByName: { hidden: true } } };
const otherAdHocChange = { id: 'organize', options: { indexByName: { second: 0, first: 1 } } };
const promotionHandler = jest.fn();

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(
      getPanelPlugin({ id: 'table' }).setPanelInteractions({
        interactions: [{ id: 0, name: 'organize', mutates: ['TRANSFORMATION'], schema: [], promotionHandler }],
      })
    ),
  getPanelPluginFromCache: () => undefined,
});

async function buildScene({ startEditing = false, withOtherTable = false } = {}) {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'table', title: 'Table' });
  const otherPanel = new VizPanel({ key: 'panel-2', pluginId: 'table', title: 'Other table' });
  const dashboard = new DashboardScene(
    {
      title: 'My dashboard',
      meta: { canSave: true, canEdit: true },
      body: DefaultGridLayoutManager.fromVizPanels(withOtherTable ? [panel, otherPanel] : [panel]),
    },
    'v2'
  );
  // Loaded dashboards keep the JSON they were built from.
  dashboard.serializer.initialSaveModel = dashboard.getSaveModel();

  // The dashboard listens for promotion requests while active, and only the panel needs to be active besides it, to
  // load its plugin and the interactions it declares. Activating the whole tree would also run the annotation layers of
  // the rebuilt dashboard.
  let deactivateDashboard = dashboard.activate();
  deactivate.push(() => deactivateDashboard(), panel.activate());
  await waitFor(() => {
    expect(panel.getPlugin()?.panelInteractions?.interactions).toHaveLength(1);
  });
  panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, [adHocChange]);
  if (withOtherTable) {
    otherPanel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, [otherAdHocChange]);
  }
  if (startEditing) {
    act(() => dashboard.onEnterEditMode());
  }

  // Remounting the dashboard component, as StrictMode does on mount, deactivates the dashboard and activates it again.
  const remountDashboard = () => {
    deactivateDashboard();
    deactivateDashboard = dashboard.activate();
  };

  return { panel, dashboard, remountDashboard };
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

function getAdHocTransformations(dashboard: DashboardScene, key = 'panel-1') {
  const currentPanel = dashboardSceneGraph.getVizPanels(dashboard).find((p) => p.state.key === key);
  return currentPanel?.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);
}

let deactivate: Array<() => void> = [];

let dataSourceFallbacks: DataSourceFallbackWatcher;

beforeEach(() => {
  dataSourceFallbacks = watchDataSourceFallbacks();
});

afterEach(() => {
  dataSourceFallbacks.expectNoFallbacks(['instance', 'settings', 'list']);
});

describe('promotePanelAdHocChanges', () => {
  afterEach(() => {
    deactivate.reverse().forEach((fn) => fn());
    deactivate = [];
  });

  beforeEach(() => {
    const grafanaSettings = makeDataSourceSettings('-- Grafana --', 'Grafana', 'grafana');
    seedDataSources([{ settings: grafanaSettings, api: annotationDataSource }], { legacySrv: 'mock' });
    promotionHandler.mockReset().mockImplementation((dashboard) => ({ ...dashboard, title: 'Promoted' }));
    mockSaveDashboard.mockReset().mockResolvedValue({
      data: { uid: 'dash-1', version: 2, url: '/d/dash-1/promoted', status: 'success' },
    });
  });

  it('passes the v2 dashboard JSON, the panel element key and its ad hoc transformations to the promotion handler', async () => {
    const { panel } = await buildScene();

    await requestPromotion(panel);

    expect(promotionHandler).toHaveBeenCalledWith(expect.objectContaining({ title: 'My dashboard' }), {
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

  it('opens the save drawer after the dashboard component remounts', async () => {
    const { panel, dashboard, remountDashboard } = await buildScene();

    act(() => remountDashboard());
    await requestPromotion(panel);

    expect(dashboard.state.title).toBe('Promoted');
    await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
  });

  it('promotes the changes once, however many times the dashboard remounts', async () => {
    const { panel, remountDashboard } = await buildScene();

    act(() => remountDashboard());
    act(() => remountDashboard());
    await requestPromotion(panel);

    expect(promotionHandler).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the panel without ad hoc transformations, so the changes are not applied twice', async () => {
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);

    const [rebuiltPanel] = dashboardSceneGraph.getVizPanels(dashboard);
    expect(rebuiltPanel.state.title).toBe('Table');
    expect(rebuiltPanel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER)).toEqual([]);
  });

  it("keeps other panels' ad hoc changes on their rebuilt panels while the save drawer is open", async () => {
    const { panel, dashboard } = await buildScene({ withOtherTable: true });

    await requestPromotion(panel);

    expect(getAdHocTransformations(dashboard, 'panel-1')).toEqual([]);
    expect(getAdHocTransformations(dashboard, 'panel-2')).toEqual([otherAdHocChange]);
  });

  it("keeps other panels' ad hoc changes after saving", async () => {
    const { panel, dashboard } = await buildScene({ withOtherTable: true });

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);

    await waitFor(() => expect(dashboard.state.isEditing).toBe(false));
    expect(getAdHocTransformations(dashboard, 'panel-2')).toEqual([otherAdHocChange]);
  });

  it("keeps other panels' ad hoc changes when cancelled", async () => {
    const { panel, dashboard } = await buildScene({ withOtherTable: true });

    await requestPromotion(panel);
    await cancelFromDrawer(dashboard);

    expect(getAdHocTransformations(dashboard, 'panel-1')).toEqual([adHocChange]);
    expect(getAdHocTransformations(dashboard, 'panel-2')).toEqual([otherAdHocChange]);
  });

  it("keeps other panels' ad hoc changes when cancelled while the user was editing", async () => {
    const { panel, dashboard } = await buildScene({ startEditing: true, withOtherTable: true });

    await requestPromotion(panel);
    await cancelFromDrawer(dashboard);

    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    expect(getAdHocTransformations(dashboard, 'panel-2')).toEqual([otherAdHocChange]);
  });

  it('restores the saved dashboard when the edit is discarded', async () => {
    const { panel, dashboard } = await buildScene();
    await requestPromotion(panel);
    expect(dashboard.state.title).toBe('Promoted');

    act(() => dashboard.exitEditMode({ skipConfirm: true }));

    expect(dashboard.state.title).toBe('My dashboard');
  });

  it('saves the promoted transformations, clears the ad hoc changes and returns to view mode when the user was not editing', async () => {
    promotionHandler.mockImplementation(tablePlugin.panelInteractions!.interactions[0].promotionHandler);
    const { panel, dashboard } = await buildScene();

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);

    await waitFor(() => expect(dashboard.state.isEditing).toBe(false));
    expect(mockSaveDashboard.mock.calls[0][0].dashboard.elements['panel-1'].spec.data.spec.transformations).toEqual([
      {
        kind: 'Transformation',
        group: 'organize',
        spec: { options: { excludeByName: { hidden: true } } },
      },
    ]);
    expect(getAdHocTransformations(dashboard)).toEqual([]);
  });

  describe('when edit mode is blocked on mobile', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.mobileEditDeprecation': true });
      setMobileViewport();
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('leaves the dashboard and the ad hoc changes untouched without opening the save drawer', async () => {
      const { panel, dashboard } = await buildScene();

      await requestPromotion(panel);

      expect(dashboard.state.title).toBe('My dashboard');
      expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);
      expect(dashboard.state.isEditing).toBeFalsy();
      expect(dashboard.state.overlay).toBeUndefined();
    });
  });

  it('stays in edit mode after saving when the user was editing', async () => {
    const { panel, dashboard } = await buildScene({ startEditing: true });

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);

    await waitFor(() => expect(dashboard.state.overlay).toBeUndefined());
    expect(dashboard.state.isEditing).toBe(true);
    expect(dashboard.state.isDirty).toBe(false);
  });

  describe('from panel edit', () => {
    async function buildSceneInPanelEdit() {
      const scene = await buildScene({ startEditing: true });
      const editPanel = buildPanelEditScene(scene.panel);
      act(() => scene.dashboard.setState({ editPanel }));
      return scene;
    }

    it('opens the save drawer with the panel editor open on the rebuilt panel', async () => {
      const { panel, dashboard } = await buildSceneInPanelEdit();

      await requestPromotion(panel);

      await waitFor(() => expect(dashboard.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
      const [rebuiltPanel] = dashboardSceneGraph.getVizPanels(dashboard);
      expect(rebuiltPanel === panel).toBe(false);
      expect(dashboard.state.editPanel?.getPanel() === rebuiltPanel).toBe(true);
    });

    it('returns to the panel editor with the ad hoc changes when cancelled', async () => {
      const { panel, dashboard } = await buildSceneInPanelEdit();

      await requestPromotion(panel);
      await cancelFromDrawer(dashboard);

      expect(dashboard.state.title).toBe('My dashboard');
      expect(dashboard.state.editPanel?.getPanel() === panel).toBe(true);
      expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);
    });
  });

  it('does not reapply saved changes as ad hoc changes when a saved promotion is undone and the edit discarded', async () => {
    promotionHandler.mockImplementation(tablePlugin.panelInteractions!.interactions[0].promotionHandler);
    const { panel, dashboard } = await buildScene({ startEditing: true });

    await requestPromotion(panel);
    await saveFromDrawer(dashboard);
    await waitFor(() => expect(dashboard.state.overlay).toBeUndefined());
    act(() => dashboard.state.sidebar.undoAction());
    expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);

    act(() => dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true }));

    const [restoredPanel] = dashboardSceneGraph.getVizPanels(dashboard);
    expect(restoredPanel.state.$data?.state).toMatchObject({
      transformations: [{ id: 'organize', options: { excludeByName: { hidden: true } } }],
    });
    expect(getAdHocTransformations(dashboard)).toEqual([]);
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

  it('undoes only the promotion and preserves earlier unsaved edits when cancelled while editing', async () => {
    const { panel, dashboard } = await buildScene({ startEditing: true });
    act(() => {
      dashboard.activateSidebar();
      changeTitle({ source: dashboard, oldValue: 'My dashboard', newValue: 'Unsaved title' });
    });
    expect(dashboard.state.title).toBe('Unsaved title');
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

    await requestPromotion(panel);
    expect(dashboard.state.title).toBe('Promoted');
    await cancelFromDrawer(dashboard);

    expect(dashboard.state.isEditing).toBe(true);
    expect(dashboard.state.title).toBe('Unsaved title');
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
    expect(getAdHocTransformations(dashboard)).toEqual([adHocChange]);
    await waitFor(() => expect(dashboard.state.isDirty).toBe(true));
    act(() => dashboard.state.sidebar.undoAction());
    expect(dashboard.state.title).toBe('My dashboard');
  });
});
