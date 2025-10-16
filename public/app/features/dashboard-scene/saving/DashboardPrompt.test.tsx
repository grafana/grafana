import { SceneQueryRunner, SceneTimeRange, VizPanel, behaviors } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { ObjectMeta } from 'app/features/apiserver/types';

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { ignoreChanges, isEmptyDashboard } from './DashboardPrompt';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
