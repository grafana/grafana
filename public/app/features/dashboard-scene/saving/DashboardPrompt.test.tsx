import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { locationService, setBackendSrv, setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  behaviors,
} from '@grafana/scenes';
import { type Dashboard, type Panel } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setupMockServer } from '@grafana/test-utils/server';
import { ModalRoot } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { type ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { type ObjectMeta } from 'app/features/apiserver/types';

import { getPendingChangesHistory, type PendingChangesHistory } from '../lifecycle/pendingChangePreview';
import { hasUnrecordedPendingChange, recordPendingChange } from '../lifecycle/pendingChangesHistory';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { type DashboardSceneState } from '../scene/types/dashboard';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';
import { createDeferred } from '../utils/test-utils';
import { getLibraryPanelBehavior } from '../utils/utils';

import { DashboardPrompt, hasChangesToLose, ignoreChanges, isEmptyDashboard } from './DashboardPrompt';

jest.mock('../lifecycle/pendingChangePreview', () => ({
  ...jest.requireActual('../lifecycle/pendingChangePreview'),
  getPendingChangesHistory: jest.fn(),
}));

jest.mock('../lifecycle/pendingChangesHistory', () => ({
  ...jest.requireActual('../lifecycle/pendingChangesHistory'),
  hasUnrecordedPendingChange: jest.fn(() => false),
  recordPendingChange: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  get locationService() {
    return jest.requireActual('@grafana/runtime').locationService;
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'gdev-testdata',
    datasources: {
      'gdev-testdata': {
        id: 1,
        uid: 'gdev-testdata',
        type: 'grafana-testdata-datasource',
        name: 'gdev-testdata',
        meta: {
          id: 'grafana-testdata-datasource',
          type: 'datasource',
          name: 'TestData',
        },
      },
      '-- Grafana --': {
        id: -1,
        uid: 'grafana',
        type: 'datasource',
        name: '-- Grafana --',
        meta: {
          id: 'grafana',
          type: 'datasource',
          name: '-- Grafana --',
        },
      },
    },
  },
}));

function getTestContext() {
  const contextSrv = { isSignedIn: true, isEditor: true } as ContextSrv;
  setContextSrv(contextSrv);

  return { contextSrv };
}

describe('DashboardPrompt', () => {
  describe('leaving the library panel editor after saving the dashboard', () => {
    const server = setupMockServer();

    beforeAll(() => {
      setBackendSrv(backendSrv);
      const plugin = getPanelPlugin({ id: 'timeseries' });
      setPluginImportUtils({ getPanelPluginFromCache: () => plugin, importPanelPlugin: async () => plugin });
    });

    const queries = (panel: VizPanel | undefined) => getQueryRunnerFor(panel)?.state.queries.map(({ refId }) => refId);
    const prompt = () => screen.findByRole('dialog', { name: 'Unsaved library panel changes' });

    function expectDashboardRestore(dashboard: DashboardScene, expectedQueries: string[]) {
      act(() => dashboard.discardChangesAndKeepEditing());
      const panels = dashboard.state.body.getVizPanels();
      expect(panels.find((panel) => panel.state.key === 'panel-1')?.state.title).toBe('Renamed ordinary panel');
      expect(queries(panels.find((panel) => panel.state.key === 'panel-2'))).toEqual(expectedQueries);
    }

    async function saveDashboardWithLibraryPanel({
      editQueries = true,
      repeat,
      beforeLibraryUpdate,
    }: {
      editQueries?: boolean;
      repeat?: 'auto' | 'custom';
      beforeLibraryUpdate?: (attempt: number) => Promise<boolean | void>;
    } = {}) {
      getTestContext();

      const library = {
        uid: 'lib-uid',
        name: 'Shared panel',
        type: 'timeseries',
        version: 1,
        model: { type: 'timeseries', targets: [{ refId: 'A' }] },
      };
      const updateLibraryPanel = jest.fn();
      server.use(
        http.get('/api/library-elements/lib-uid/connections', () => HttpResponse.json({ result: [] })),
        http.patch<{ uid: string }, { model: Panel }>('/api/library-elements/:uid', async ({ request }) => {
          const { model } = await request.json();
          updateLibraryPanel(model);
          if ((await beforeLibraryUpdate?.(updateLibraryPanel.mock.calls.length)) === false) {
            return HttpResponse.json({ message: 'Library panel update failed' }, { status: 500 });
          }
          return HttpResponse.json({ result: { ...library, version: 2, model } });
        })
      );

      const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
      const panel = new VizPanel({
        key: 'panel-2',
        title: 'Shared panel',
        pluginId: 'timeseries',
        $data: runner,
        $behaviors: [
          new LibraryPanelBehavior({ uid: library.uid, name: library.name, _loadedPanel: library, isLoaded: true }),
        ],
      });
      const ordinaryPanel = new VizPanel({ key: 'panel-1', title: 'Ordinary panel', pluginId: 'text' });
      const libraryItem =
        repeat === 'custom'
          ? new DashboardGridItem({ body: panel, x: 0, y: 0, width: 8, height: 8, itemHeight: 8, repeatDirection: 'v' })
          : new AutoGridItem({ body: panel });
      const autoGrid = AutoGridLayoutManager.createEmpty();
      const body =
        libraryItem instanceof DashboardGridItem
          ? new DefaultGridLayoutManager({
              grid: new SceneGridLayout({
                children: [
                  libraryItem,
                  new DashboardGridItem({ body: ordinaryPanel, x: 0, y: 16, width: 8, height: 8 }),
                ],
              }),
            })
          : autoGrid;
      if (libraryItem instanceof AutoGridItem) {
        autoGrid.state.layout.setState({ children: [new AutoGridItem({ body: ordinaryPanel }), libraryItem] });
      }
      const repeatVariable = new CustomVariable({
        name: 'env',
        query: 'staging,production,testing',
        isMulti: true,
        value: ['staging', 'production'],
        text: ['staging', 'production'],
      });
      const dashboard = buildTestScene(
        {
          body,
          isEditing: true,
          meta: { canSave: true, version: 1 },
          $variables: new SceneVariableSet({ variables: [repeatVariable] }),
        },
        'v2'
      );
      dashboard.setInitialSaveModel(transformSceneToSaveModelSchemaV2(dashboard));
      ordinaryPanel.setState({ title: 'Renamed ordinary panel' });
      dashboard.setState({ editPanel: buildPanelEditScene(panel), isDirty: true });
      panel.setState({ title: 'Saved instance title' });
      if (libraryItem instanceof AutoGridItem) {
        libraryItem.setFitContent(true);
      }
      if (repeat) {
        libraryItem.setRepeatByVariable('env');
        libraryItem.performRepeat();
      }
      if (editQueries) {
        runner.setState({ queries: [{ refId: 'A' }, { refId: 'B' }] });
      }

      const { user, unmount } = render(
        <>
          <DashboardPrompt dashboard={dashboard} />
          <ModalRoot />
        </>,
        { historyOptions: { initialEntries: ['/d/dash-1'] } }
      );
      act(() => locationService.partial({ editPanel: 2 }));

      await dashboard.saveCompleted(dashboard.getSaveModel(), {
        slug: 'hello',
        uid: 'dash-1',
        url: '/d/dash-1',
        version: 2,
        status: 'success',
      });
      expect(dashboard.state.isDirty).toBe(false);
      expect(updateLibraryPanel).not.toHaveBeenCalled();

      act(() => locationService.getHistory().goBack());

      return { user, unmount, dashboard, ordinaryPanel, libraryItem, repeatVariable, updateLibraryPanel };
    }

    it('keeps both queries in the editor on Cancel and prompts again on Back', async () => {
      const { user, dashboard, libraryItem, updateLibraryPanel } = await saveDashboardWithLibraryPanel();
      const dialog = await prompt();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(locationService.getSearchObject()).toMatchObject({ editPanel: '2' });
      expect(queries(libraryItem.state.body)).toEqual(['A', 'B']);
      expect(updateLibraryPanel).not.toHaveBeenCalled();

      dashboard.setState({ meta: { ...dashboard.state.meta, url: '/d/dash-1/renamed' } });
      act(() => locationService.replace({ pathname: '/d/dash-1/renamed', search: '?editPanel=2' }));
      expect(locationService.getLocation().pathname).toBe('/d/dash-1/renamed');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      act(() => locationService.getHistory().goBack());
      expect(await prompt()).toBeVisible();
    });

    it.each(['auto', 'custom'] as const)('discards drafts and rebuilds repeats in the %s grid', async (repeat) => {
      const { user, dashboard, ordinaryPanel, libraryItem, repeatVariable, updateLibraryPanel } =
        await saveDashboardWithLibraryPanel({ repeat });
      const dialog = await prompt();
      const values = ['staging', 'production', 'testing'];
      act(() => {
        repeatVariable.setState({ value: values, text: values });
        libraryItem.performRepeat();
      });
      const sibling = ordinaryPanel.parent;
      const siblingPosition = sibling instanceof DashboardGridItem ? sibling.state.y : undefined;
      await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

      await waitFor(() => expect(locationService.getSearchObject()).toEqual({}));
      expect(libraryItem.state.body.state.title).toBe('Saved instance title');
      expect(queries(libraryItem.state.body)).toEqual(['A']);
      expect(libraryItem.state.repeatedPanels?.map(queries)).toEqual([['A'], ['A']]);
      if (libraryItem instanceof AutoGridItem) {
        expect(libraryItem.state.fitContent).toBe(true);
        expect(libraryItem.state.repeatedConditionalRendering?.[0].getTarget()).toBe(
          libraryItem.state.repeatedPanels?.[0]
        );
      } else {
        expect(libraryItem.state.height).toBe(24);
        expect(sibling?.state).toHaveProperty('y', siblingPosition);
      }
      expect(updateLibraryPanel).not.toHaveBeenCalled();
      expectDashboardRestore(dashboard, ['A']);
    });

    it('keeps the draft open when Update all fails and publishes it on retry', async () => {
      const { user, libraryItem, updateLibraryPanel } = await saveDashboardWithLibraryPanel({
        beforeLibraryUpdate: async (attempt) => attempt > 1,
      });
      const dialog = await prompt();
      const update = within(dialog).getByRole('button', { name: 'Update all' });
      await user.click(update);
      await waitFor(() => expect(updateLibraryPanel).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(update).toBeEnabled());

      expect(locationService.getSearchObject()).toMatchObject({ editPanel: '2' });
      expect(queries(libraryItem.state.body)).toEqual(['A', 'B']);

      await user.click(update);
      await waitFor(() => expect(locationService.getSearchObject()).toEqual({}));
      expect(updateLibraryPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({ targets: [{ refId: 'A' }, { refId: 'B' }] })
      );
    });

    it('publishes once on Update all and resumes Back after competing navigation', async () => {
      const request = createDeferred<void>();
      const { user, dashboard, libraryItem, updateLibraryPanel } = await saveDashboardWithLibraryPanel({
        repeat: 'auto',
        beforeLibraryUpdate: () => request.promise,
      });
      const dialog = await prompt();
      const update = within(dialog).getByRole('button', { name: 'Update all' });
      await user.dblClick(update);
      await waitFor(() => expect(updateLibraryPanel).toHaveBeenCalledTimes(1));

      try {
        act(() => locationService.partial({ editPanel: 1 }));
        expect(locationService.getSearchObject()).toMatchObject({ editPanel: '2' });
        expect(update).toBeDisabled();
      } finally {
        request.resolve();
      }

      await waitFor(() => expect(locationService.getSearchObject()).toEqual({}));
      expect(updateLibraryPanel).toHaveBeenCalledTimes(1);
      expect(updateLibraryPanel).toHaveBeenCalledWith(
        expect.objectContaining({ targets: [{ refId: 'A' }, { refId: 'B' }] })
      );
      expect(queries(libraryItem.state.body)).toEqual(['A', 'B']);
      expect(libraryItem.state.repeatedPanels?.map(queries)).toEqual([['A', 'B']]);
      expectDashboardRestore(dashboard, ['A', 'B']);
    });

    it('does not replay Back after the dashboard leaves while publication is pending', async () => {
      const request = createDeferred<void>();
      const { user, unmount, libraryItem, updateLibraryPanel } = await saveDashboardWithLibraryPanel({
        beforeLibraryUpdate: () => request.promise,
      });
      const dialog = await prompt();
      await user.click(within(dialog).getByRole('button', { name: 'Update all' }));
      await waitFor(() => expect(updateLibraryPanel).toHaveBeenCalledTimes(1));

      unmount();
      locationService.push('/dashboard-list');
      request.resolve();

      await waitFor(() => expect(getLibraryPanelBehavior(libraryItem.state.body)?.state._loadedPanel?.version).toBe(2));
      expect(locationService.getLocation().pathname).toBe('/dashboard-list');
    });

    it('lets Back leave a clean library panel without a prompt', async () => {
      const { ordinaryPanel, updateLibraryPanel } = await saveDashboardWithLibraryPanel({ editQueries: false });

      expect(locationService.getSearchObject()).toEqual({});
      expect(ordinaryPanel.state.title).toBe('Renamed ordinary panel');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(updateLibraryPanel).not.toHaveBeenCalled();
    });
  });

  describe('ignoreChanges', () => {
    beforeEach(() => {
      getTestContext();
    });

    describe('when called without original dashboard', () => {
      it('then it should return true', () => {
        const scene = buildTestScene();
        scene.setInitialSaveModel(undefined);
        expect(ignoreChanges(scene)).toBe(true);
      });
    });

    describe('when called without current dashboard', () => {
      it('then it should return true', () => {
        expect(ignoreChanges(null)).toBe(true);
      });
    });

    describe('when called for a viewer without save permissions', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const scene = buildTestScene({
          meta: {
            canSave: false,
          },
        });
        contextSrv.isEditor = false;

        expect(ignoreChanges(scene)).toBe(true);
      });
    });

    describe('when called for a viewer with save permissions', () => {
      it('then it should return undefined', () => {
        const { contextSrv } = getTestContext();

        const scene = buildTestScene({
          meta: {
            canSave: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        scene.setInitialSaveModel(initialSaveModel);

        contextSrv.isEditor = false;

        expect(ignoreChanges(scene)).toBe(undefined);
      });
    });

    describe('when called for an user that is not signed in', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const scene = buildTestScene({
          meta: {
            canSave: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        scene.setInitialSaveModel(initialSaveModel);

        contextSrv.isSignedIn = false;
        expect(ignoreChanges(scene)).toBe(true);
      });
    });

    describe('when called with fromScript', () => {
      it('then it should return true', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        scene.setInitialSaveModel(initialSaveModel);

        expect(ignoreChanges(scene)).toBe(true);
      });
    });

    describe('when called with fromFile', () => {
      it('then it should return true', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: undefined,
            fromFile: true,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        scene.setInitialSaveModel(initialSaveModel);

        expect(ignoreChanges(scene)).toBe(true);
      });
    });

    describe('when called with canSave but without fromScript and fromFile', () => {
      it('then it should return false', () => {
        const scene = buildTestScene({
          meta: {
            canSave: true,
            fromScript: undefined,
            fromFile: undefined,
          },
        });
        const initialSaveModel = transformSceneToSaveModel(scene);
        scene.setInitialSaveModel(initialSaveModel);

        expect(ignoreChanges(scene)).toBe(undefined);
      });
    });

    describe('when the dashboard shows pending changes whose plugin keeps their history', () => {
      afterEach(() => jest.mocked(getPendingChangesHistory).mockReturnValue(undefined));

      it('then it should return true, as every edit was recorded when it was made', () => {
        const scene = buildTestScene({ meta: { canSave: true } });
        scene.setInitialSaveModel(transformSceneToSaveModel(scene));
        jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);

        expect(ignoreChanges(scene)).toBe(true);
      });

      // A new dashboard proposed as pending changes has version 0, which otherwise ignores changes.
      it('then it should return false for a draft while an edit failed to reach the plugin', () => {
        const scene = buildTestScene({ meta: { canSave: true, version: 0 } });
        scene.setInitialSaveModel(transformSceneToSaveModel(scene));
        jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);
        jest.mocked(hasUnrecordedPendingChange).mockReturnValueOnce(true);

        expect(ignoreChanges(scene)).toBe(false);
      });

      // Leaving would lose it: the plugin never got it.
      it('then it should return false while an edit failed to reach the plugin', () => {
        const scene = buildTestScene({ meta: { canSave: true } });
        scene.setInitialSaveModel(transformSceneToSaveModel(scene));
        jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);
        jest.mocked(hasUnrecordedPendingChange).mockReturnValueOnce(true);

        expect(ignoreChanges(scene)).toBe(false);
      });

      // Recording cleared isDirty before the request failed, so leaving the tab or page must not go by it alone.
      it('counts an edit that failed to reach the plugin as a change leaving would lose', () => {
        const scene = buildTestScene({ meta: { canSave: true } });
        scene.setState({ isDirty: false });
        expect(hasChangesToLose(scene)).toBe(false);

        jest.mocked(hasUnrecordedPendingChange).mockReturnValueOnce(true);
        expect(hasChangesToLose(scene)).toBe(true);
      });

      // Exiting discards an open panel editor, so the edit is read before that, and a failed one is retried.
      it('records an edit that failed to reach the plugin as edit mode ends, before leaving it', () => {
        const scene = buildTestScene({ meta: { canSave: true } });
        scene.onEnterEditMode();
        jest.mocked(getPendingChangesHistory).mockReturnValue({} as PendingChangesHistory);
        jest.mocked(hasUnrecordedPendingChange).mockReturnValue(true);

        scene.exitEditMode({ skipConfirm: false });

        expect(recordPendingChange).toHaveBeenCalledWith(scene, expect.anything(), 'Edit dashboard');
        expect(scene.state.isEditing).toBe(false);
        jest.mocked(hasUnrecordedPendingChange).mockReturnValue(false);
      });
    });
  });

  describe('isEmptyDashboard', () => {
    describe('Dashboard V1 tests', () => {
      describe('empty dashboard cases', () => {
        it('should return true for completely empty dashboard', () => {
          const emptyDashboard: Dashboard = {
            id: null,
            uid: '',
            title: '',
            tags: [],
            panels: [],
            schemaVersion: 16,
            version: 0,
            links: [],
            time: { from: 'now-6h', to: 'now' },
            timepicker: {},
            templating: { list: [] },
            annotations: { list: [] },
          };

          expect(isEmptyDashboard(emptyDashboard)).toBe(true);
        });

        it('should return true for dashboard with no panels, links, templates, or uid', () => {
          const scene = buildTestScene(
            {
              uid: '',
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v1'
          );
          const dashboard = scene.getSaveModel() as Dashboard;
          dashboard.links = [];
          dashboard.templating = { list: [] };
          dashboard.uid = '';

          expect(isEmptyDashboard(dashboard)).toBe(true);
        });
      });

      describe('non-empty dashboard cases', () => {
        it('should return false for dashboard with panels', () => {
          const scene = buildTestScene();
          const dashboard = scene.getSaveModel();

          expect(isEmptyDashboard(dashboard)).toBe(false);
        });

        it('should return false for dashboard with links', () => {
          const scene = buildTestScene(
            {
              uid: '',
              body: DefaultGridLayoutManager.fromVizPanels([]),
              links: [
                {
                  title: 'Test Link',
                  url: 'https://example.com',
                  type: 'link',
                  icon: 'external link',
                  tooltip: '',
                  asDropdown: false,
                  tags: [],
                  includeVars: false,
                  keepTime: false,
                  targetBlank: false,
                },
              ],
            },
            'v1'
          );
          const dashboard = scene.getSaveModel() as Dashboard;
          dashboard.templating = { list: [] };

          expect(isEmptyDashboard(dashboard)).toBe(false);
        });

        it('should return false for dashboard with template variables', () => {
          const scene = buildTestScene(
            {
              uid: '',
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v1'
          );
          const dashboard = scene.getSaveModel() as Dashboard;
          dashboard.links = [];
          dashboard.templating = {
            list: [
              {
                name: 'testVar',
                type: 'query',
                query: 'test query',
                current: { value: 'test', text: 'test' },
                options: [],
              },
            ],
          };

          expect(isEmptyDashboard(dashboard)).toBe(false);
        });

        it('should return false for dashboard with uid', () => {
          const scene = buildTestScene(
            {
              uid: 'test-uid-123',
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v1'
          );
          const dashboard = scene.getSaveModel() as Dashboard;
          dashboard.links = [];
          dashboard.templating = { list: [] };

          expect(isEmptyDashboard(dashboard)).toBe(false);
        });
      });
    });

    describe('Dashboard V2 tests', () => {
      describe('empty dashboard cases', () => {
        it('should return true for completely empty dashboard v2', () => {
          const emptyDashboardV2: DashboardV2Spec = {
            title: '',
            tags: [],
            elements: {},
            layout: {
              kind: 'GridLayout',
              spec: {
                items: [],
              },
            },
            links: [],
            variables: [],
            annotations: [],
            timeSettings: {
              from: 'now-6h',
              to: 'now',
              timezone: 'browser',
              weekStart: 'monday',
              fiscalYearStartMonth: 0,
              autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
              autoRefresh: '5s',
              hideTimepicker: false,
            },
            cursorSync: 'Off',
            liveNow: false,
            preload: false,
          };
          const emptyMetadata: ObjectMeta = {
            name: '',
            resourceVersion: '1',
            creationTimestamp: '2023-01-01T00:00:00Z',
          };

          expect(isEmptyDashboard(emptyDashboardV2, emptyMetadata)).toBe(true);
        });

        it('should return true for dashboard v2 with no elements, links, variables, or name', () => {
          const scene = buildTestScene(
            {
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v2'
          );
          const dashboard = scene.getSaveModel();
          const metadata: ObjectMeta = {
            name: '',
            resourceVersion: '1',
            creationTimestamp: '2023-01-01T00:00:00Z',
          };

          expect(isEmptyDashboard(dashboard, metadata)).toBe(true);
        });
      });

      describe('non-empty dashboard cases', () => {
        it('should return false for dashboard v2 with elements', () => {
          const scene = buildTestScene({}, 'v2');
          const dashboard = scene.getSaveModel();

          expect(isEmptyDashboard(dashboard)).toBe(false);
        });

        it('should return false for dashboard v2 with links', () => {
          const scene = buildTestScene(
            {
              body: DefaultGridLayoutManager.fromVizPanels([]),
              links: [
                {
                  title: 'Test Link V2',
                  url: 'https://example.com',
                  type: 'link',
                  icon: 'external link',
                  tooltip: '',
                  asDropdown: false,
                  tags: [],
                  includeVars: false,
                  keepTime: false,
                  targetBlank: false,
                },
              ],
            },
            'v2'
          );
          const dashboard = scene.getSaveModel();
          const metadata: ObjectMeta = {
            name: '',
            resourceVersion: '1',
            creationTimestamp: '2023-01-01T00:00:00Z',
          };

          expect(isEmptyDashboard(dashboard, metadata)).toBe(false);
        });

        it('should return false for dashboard v2 with variables', () => {
          const scene = buildTestScene(
            {
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v2'
          );
          const dashboard = scene.getSaveModel() as DashboardV2Spec;
          dashboard.variables = [
            { kind: 'ConstantVariable', spec: { name: 'testVar' } } as DashboardV2Spec['variables'][number],
          ];
          const metadata: ObjectMeta = {
            name: '',
            resourceVersion: '1',
            creationTimestamp: '2023-01-01T00:00:00Z',
          };

          expect(isEmptyDashboard(dashboard, metadata)).toBe(false);
        });

        it('should return false for dashboard v2 with name in metadata', () => {
          const scene = buildTestScene(
            {
              body: DefaultGridLayoutManager.fromVizPanels([]),
            },
            'v2'
          );
          const dashboard = scene.getSaveModel();
          const metadata: ObjectMeta = {
            name: 'test-dashboard-with-name',
            resourceVersion: '1',
            creationTimestamp: '2023-01-01T00:00:00Z',
          };

          expect(isEmptyDashboard(dashboard, metadata)).toBe(false);
        });
      });
    });
  });
});

function buildTestScene(overrides?: Partial<DashboardSceneState>, serializerVersion: 'v1' | 'v2' = 'v1') {
  const defaultPanels = [
    new VizPanel({
      title: 'Panel A',
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
    }),
  ];

  const scene = new DashboardScene(
    {
      title: 'hello',
      uid: 'dash-1',
      description: 'hello description',
      tags: ['tag1', 'tag2'],
      editable: true,
      $timeRange: new SceneTimeRange({
        timeZone: 'browser',
      }),
      controls: new DashboardControls({}),
      $behaviors: [new behaviors.CursorSync({})],
      body: DefaultGridLayoutManager.fromVizPanels(defaultPanels),
      ...overrides,
    },
    serializerVersion
  );

  return scene;
}
