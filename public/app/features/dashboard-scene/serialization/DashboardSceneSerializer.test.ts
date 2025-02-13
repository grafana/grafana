import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  MultiValueVariable,
  sceneGraph,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { Dashboard, VariableModel } from '@grafana/schema';
import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultPanelSpec,
  defaultTimeSettingsSpec,
  GridLayoutKind,
  PanelSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { AnnoKeyDashboardSnapshotOriginalUrl } from 'app/features/apiserver/types';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { findVizPanelByKey } from '../utils/utils';

import { V1DashboardSerializer, V2DashboardSerializer } from './DashboardSceneSerializer';
import { getPanelElement, transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: jest.fn(),
    };
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      settings: {
        defaultDatasource: '-- Grafana --',
        datasources: {
          '-- Grafana --': {
            name: 'Grafana',
            meta: { id: 'grafana' },
            type: 'datasource',
          },
          prometheus: {
            name: 'prometheus',
            meta: { id: 'prometheus' },
            type: 'datasource',
          },
        },
      },
    },
  },
}));

describe('DashboardSceneSerializer', () => {
  describe('v1 schema', () => {
    beforeEach(() => {
      config.featureToggles.useV2DashboardsAPI = false;
    });

    it('Can detect no changes', () => {
      const dashboard = setup();
      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
    });

    it('Can detect time changed', () => {
      const dashboard = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
      expect(result.hasTimeChanges).toBe(true);
    });

    it('Can save time change', () => {
      const dashboard = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      const result = dashboard.getDashboardChanges(true);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(1);
    });

    it('Can detect folder change', () => {
      const dashboard = setup();

      dashboard.state.meta.folderUid = 'folder-2';

      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(0); // Diff count is 0 because the diff contemplate only the model
      expect(result.hasFolderChanges).toBe(true);
    });

    it('Can detect refresh changed', () => {
      const dashboard = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      const result = dashboard.getDashboardChanges(false, false, false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
      expect(result.hasRefreshChange).toBe(true);
    });

    it('Can save refresh change', () => {
      const dashboard = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      const result = dashboard.getDashboardChanges(false, false, true);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(1);
    });

    describe('variable changes', () => {
      it('Can detect variable change', () => {
        const dashboard = setup();

        const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
        appVar.changeValueTo('app2');

        const result = dashboard.getDashboardChanges(false, false);

        expect(result.hasVariableValueChanges).toBe(true);
        expect(result.hasChanges).toBe(false);
        expect(result.diffCount).toBe(0);
      });

      it('Can save variable value change', () => {
        const dashboard = setup();

        const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
        appVar.changeValueTo('app2');

        const result = dashboard.getDashboardChanges(false, true);

        expect(result.hasVariableValueChanges).toBe(true);
        expect(result.hasChanges).toBe(true);
        expect(result.diffCount).toBe(2);
      });

      describe('Experimental variables', () => {
        beforeAll(() => {
          config.featureToggles.groupByVariable = true;
        });

        afterAll(() => {
          config.featureToggles.groupByVariable = false;
        });

        it('Can detect group by static options change', () => {
          const dashboard = transformSaveModelToScene({
            dashboard: {
              title: 'hello',
              uid: 'my-uid',
              schemaVersion: 30,
              panels: [
                {
                  id: 1,
                  title: 'Panel 1',
                  type: 'text',
                },
              ],
              version: 10,
              templating: {
                list: [
                  {
                    type: 'groupby',
                    datasource: {
                      type: 'ds',
                      uid: 'ds-uid',
                    },
                    name: 'GroupBy',
                    options: [
                      {
                        text: 'Host',
                        value: 'host',
                      },
                      {
                        text: 'Region',
                        value: 'region',
                      },
                    ],
                  },
                ],
              },
            },
            meta: {},
          });
          const initialSaveModel = transformSceneToSaveModel(dashboard);
          dashboard.setInitialSaveModel(initialSaveModel);

          const variable = sceneGraph.lookupVariable('GroupBy', dashboard) as GroupByVariable;
          variable.setState({ defaultOptions: [{ text: 'Host', value: 'host' }] });
          const result = dashboard.getDashboardChanges(false, true);

          expect(result.hasVariableValueChanges).toBe(false);
          expect(result.hasChanges).toBe(true);
          expect(result.diffCount).toBe(1);
        });

        it('Can detect adhoc filter static options change', () => {
          const adhocVar = {
            id: 'adhoc',
            name: 'adhoc',
            label: 'Adhoc Label',
            description: 'Adhoc Description',
            type: 'adhoc',
            datasource: {
              uid: 'gdev-prometheus',
              type: 'prometheus',
            },
            filters: [],
            baseFilters: [],
            defaultKeys: [
              {
                text: 'Host',
                value: 'host',
              },
              {
                text: 'Region',
                value: 'region',
              },
            ],
          } as VariableModel;

          const dashboard = transformSaveModelToScene({
            dashboard: {
              title: 'hello',
              uid: 'my-uid',
              schemaVersion: 30,
              panels: [
                {
                  id: 1,
                  title: 'Panel 1',
                  type: 'text',
                },
              ],
              version: 10,
              templating: {
                list: [adhocVar],
              },
            },
            meta: {},
          });

          const initialSaveModel = transformSceneToSaveModel(dashboard);
          dashboard.setInitialSaveModel(initialSaveModel);

          const variable = sceneGraph.lookupVariable('adhoc', dashboard) as AdHocFiltersVariable;
          variable.setState({ defaultKeys: [{ text: 'Host', value: 'host' }] });
          const result = dashboard.getDashboardChanges(false, false);

          expect(result.hasVariableValueChanges).toBe(false);
          expect(result.hasChanges).toBe(true);
          expect(result.diffCount).toBe(1);
        });
      });
    });

    describe('Saving from panel edit', () => {
      it('Should commit panel edit changes', () => {
        const dashboard = setup();
        const panel = findVizPanelByKey(dashboard, 'panel-1')!;
        const editScene = buildPanelEditScene(panel);

        dashboard.onEnterEditMode();
        dashboard.setState({ editPanel: editScene });

        editScene.state.panelRef.resolve().setState({ title: 'changed title' });

        const result = dashboard.getDashboardChanges(false, true);
        const panelSaveModel = (result.changedSaveModel as Dashboard).panels![0];
        expect(panelSaveModel.title).toBe('changed title');
      });
    });

    describe('tracking information', () => {
      it('provides dashboard tracking information with no initial save model', () => {
        const serializer = new V1DashboardSerializer();
        expect(serializer.getTrackingInformation()).toBe(undefined);
      });

      it('provides dashboard tracking information with from initial save model', () => {
        const dashboard = setup({
          schemaVersion: 30,
          version: 10,
          uid: 'my-uid',
          title: 'hello',
          liveNow: true,
          panels: [
            {
              type: 'text',
            },
            {
              type: 'text',
            },
            {
              type: 'timeseries',
            },
          ],

          templating: {
            list: [
              {
                type: 'query',
                name: 'server',
              },
              {
                type: 'query',
                name: 'host',
              },
              {
                type: 'textbox',
                name: 'search',
              },
            ],
          },
        });

        expect(dashboard.getTrackingInformation()).toEqual({
          uid: 'my-uid',
          title: 'hello',
          schemaVersion: DASHBOARD_SCHEMA_VERSION,
          panels_count: 3,
          panel_type_text_count: 2,
          panel_type_timeseries_count: 1,
          variable_type_query_count: 2,
          variable_type_textbox_count: 1,
          settings_nowdelay: undefined,
          settings_livenow: true,
        });
      });
    });

    it('should allow retrieving snapshot url', () => {
      const initialSaveModel: Dashboard = {
        snapshot: {
          originalUrl: 'originalUrl/snapshot',
          created: '2023-01-01T00:00:00Z',
          expires: '2023-12-31T23:59:59Z',
          external: false,
          externalUrl: '',
          id: 1,
          key: 'snapshot-key',
          name: 'snapshot-name',
          orgId: 1,
          updated: '2023-01-01T00:00:00Z',
          userId: 1,
        },
        title: 'hello',
        uid: 'my-uid',
        schemaVersion: 30,
        version: 10,
      };

      const serializer = new V1DashboardSerializer();
      serializer.initialSaveModel = initialSaveModel;

      expect(serializer.getSnapshotUrl()).toBe('originalUrl/snapshot');
    });
  });

  describe('v2 schema', () => {
    beforeEach(() => {
      config.featureToggles.useV2DashboardsAPI = true;
    });

    it('Can detect no changes', () => {
      const dashboard = setupV2();
      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
    });

    it('Can detect time changed', () => {
      const dashboard = setupV2();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-10h', to: 'now' });

      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
      expect(result.hasTimeChanges).toBe(true);
    });

    it('Can save time change', () => {
      const dashboard = setupV2();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-10h', to: 'now' });

      const result = dashboard.getDashboardChanges(true);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(1);
    });

    it('Can detect folder change', () => {
      const dashboard = setupV2();

      dashboard.state.meta.folderUid = 'folder-2';

      const result = dashboard.getDashboardChanges(false);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(0); // Diff count is 0 because the diff contemplate only the model
      expect(result.hasFolderChanges).toBe(true);
    });

    it('Can detect refresh changed', () => {
      const dashboard = setupV2();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '10m' });
      }

      const result = dashboard.getDashboardChanges(false, false, false);
      expect(result.hasChanges).toBe(false);
      expect(result.diffCount).toBe(0);
      expect(result.hasRefreshChange).toBe(true);
    });

    it('Can save refresh change', () => {
      const dashboard = setupV2();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '10m' });
      }

      const result = dashboard.getDashboardChanges(false, false, true);
      expect(result.hasChanges).toBe(true);
      expect(result.diffCount).toBe(1);
    });

    describe('variable changes', () => {
      it('Can detect variable change', () => {
        const dashboard = setupV2();

        const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
        appVar.changeValueTo('app2');

        const result = dashboard.getDashboardChanges(false, false);

        expect(result.hasVariableValueChanges).toBe(true);
        expect(result.hasChanges).toBe(false);
        expect(result.diffCount).toBe(0);
      });

      it('Can save variable value change', () => {
        const dashboard = setupV2();

        const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
        appVar.changeValueTo('app2');

        const result = dashboard.getDashboardChanges(false, true);

        expect(result.hasVariableValueChanges).toBe(true);
        expect(result.hasChanges).toBe(true);
        expect(result.diffCount).toBe(2);
      });

      describe('Experimental variables', () => {
        beforeAll(() => {
          config.featureToggles.groupByVariable = true;
        });

        afterAll(() => {
          config.featureToggles.groupByVariable = false;
        });

        it('Can detect group by static options change', () => {
          const dashboard = setupV2({
            variables: [
              {
                kind: 'GroupByVariable',
                spec: {
                  current: {
                    text: 'Host',
                    value: 'host',
                  },
                  datasource: {
                    type: 'ds',
                    uid: 'ds-uid',
                  },
                  name: 'GroupBy',
                  options: [
                    {
                      text: 'Host',
                      value: 'host',
                    },
                    {
                      text: 'Region',
                      value: 'region',
                    },
                  ],
                  multi: false,
                  hide: 'dontHide',
                  skipUrlSync: false,
                },
              },
            ],
          });

          const variable = sceneGraph.lookupVariable('GroupBy', dashboard) as GroupByVariable;
          variable.setState({ defaultOptions: [{ text: 'Host', value: 'host' }] });
          const result = dashboard.getDashboardChanges(false, true);

          expect(result.hasVariableValueChanges).toBe(false);
          expect(result.hasChanges).toBe(true);
          expect(result.diffCount).toBe(1);
        });

        it('Can detect adhoc filter static options change', () => {
          const dashboard = setupV2({
            variables: [
              {
                kind: 'AdhocVariable',
                spec: {
                  name: 'adhoc',
                  label: 'Adhoc Label',
                  description: 'Adhoc Description',
                  datasource: {
                    uid: 'gdev-prometheus',
                    type: 'prometheus',
                  },
                  hide: 'dontHide',
                  skipUrlSync: false,
                  filters: [],
                  baseFilters: [],
                  defaultKeys: [
                    {
                      text: 'Host',
                      value: 'host',
                    },
                    {
                      text: 'Region',
                      value: 'region',
                    },
                  ],
                },
              },
            ],
          });

          const variable = sceneGraph.lookupVariable('adhoc', dashboard) as AdHocFiltersVariable;
          variable.setState({ defaultKeys: [{ text: 'Host', value: 'host' }] });
          const result = dashboard.getDashboardChanges(false, false);

          expect(result.hasVariableValueChanges).toBe(false);
          expect(result.hasChanges).toBe(true);
          expect(result.diffCount).toBe(1);
        });
      });
    });

    describe('Saving from panel edit', () => {
      it('Should commit panel edit changes', () => {
        const dashboard = setupV2();
        const panel = findVizPanelByKey(dashboard, 'panel-1')!;
        const editScene = buildPanelEditScene(panel);

        dashboard.onEnterEditMode();
        dashboard.setState({ editPanel: editScene });

        editScene.state.panelRef.resolve().setState({ title: 'changed title' });

        const result = dashboard.getDashboardChanges(false, true);
        const panelSaveModel = getPanelElement(result.changedSaveModel as DashboardV2Spec, 'panel-1')!;

        expect(panelSaveModel.spec.title).toBe('changed title');
      });
    });

    describe('tracking information', () => {
      it('provides dashboard tracking information with no initial save model', () => {
        const dashboard = setupV2();
        const serializer = new V2DashboardSerializer();
        expect(serializer.getTrackingInformation(dashboard)).toBe(undefined);
      });

      it('provides dashboard tracking information with from initial save model', () => {
        const dashboard = setupV2({
          timeSettings: {
            nowDelay: '10s',
            from: '',
            to: '',
            autoRefresh: '',
            autoRefreshIntervals: [],
            hideTimepicker: false,
            fiscalYearStartMonth: 0,
            timezone: '',
          },
          liveNow: true,
        });

        expect(dashboard.getTrackingInformation()).toEqual({
          uid: 'dashboard-test',
          title: 'hello',
          panels_count: 1,
          panel_type__count: 1,
          variable_type_custom_count: 1,
          settings_nowdelay: undefined,
          settings_livenow: true,
          schemaVersion: DASHBOARD_SCHEMA_VERSION,
        });
      });
    });

    describe('getSaveAsModel', () => {
      let serializer: V2DashboardSerializer;
      let dashboard: DashboardScene;
      let baseOptions: SaveDashboardAsOptions;

      beforeEach(() => {
        serializer = new V2DashboardSerializer();
        dashboard = setupV2();
        baseOptions = {
          title: 'I am a new dashboard',
          description: 'description goes here',
          isNew: true,
          copyTags: true,
        };
      });

      it('should set basic dashboard properties correctly', () => {
        const saveAsModel = serializer.getSaveAsModel(dashboard, baseOptions);

        expect(saveAsModel).toMatchObject({
          title: baseOptions.title,
          description: baseOptions.description,
          editable: true,
          annotations: [],
          cursorSync: 'Off',
          liveNow: false,
          preload: false,
          tags: [],
        });
      });

      it('should handle time settings correctly', () => {
        const saveAsModel = serializer.getSaveAsModel(dashboard, baseOptions);

        expect(saveAsModel.timeSettings).toEqual({
          autoRefresh: '10s',
          autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
          fiscalYearStartMonth: 0,
          from: 'now-1h',
          hideTimepicker: false,
          nowDelay: undefined,
          timezone: 'browser',
          to: 'now',
        });
      });

      it('should correctly serialize panel elements', () => {
        const saveAsModel = serializer.getSaveAsModel(dashboard, baseOptions);

        expect(saveAsModel.elements['panel-1']).toMatchObject({
          kind: 'Panel',
          spec: {
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                queryOptions: {},
                transformations: [],
              },
            },
            description: '',
            id: 1,
            links: [],
            title: 'Panel 1',
          },
        });
      });

      it('should correctly serialize layout configuration', () => {
        const saveAsModel = serializer.getSaveAsModel(dashboard, baseOptions);

        expect(saveAsModel.layout).toEqual({
          kind: 'GridLayout',
          spec: {
            items: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  element: {
                    kind: 'ElementReference',
                    name: 'panel-1',
                  },
                  height: 8,
                  width: 12,
                  x: 0,
                  y: 0,
                },
              },
            ],
          },
        });
      });

      it('should correctly serialize variables', () => {
        const saveAsModel = serializer.getSaveAsModel(dashboard, baseOptions);

        expect(saveAsModel.variables).toEqual([
          {
            kind: 'CustomVariable',
            spec: {
              allValue: undefined,
              current: {
                text: 'app1',
                value: 'app1',
              },
              description: 'A query variable',
              hide: 'dontHide',
              includeAll: false,
              label: 'Query Variable',
              multi: false,
              name: 'app',
              options: [],
              query: 'app1',
              skipUrlSync: false,
            },
          },
        ]);
      });

      it('should handle empty dashboard state', () => {
        const emptyDashboard = setupV2({
          elements: {},
          layout: { kind: 'GridLayout', spec: { items: [] } },
          variables: [],
        });

        const saveAsModel = serializer.getSaveAsModel(emptyDashboard, baseOptions);

        expect(saveAsModel.elements).toEqual({});
        expect(saveAsModel.layout.kind).toBe('GridLayout');
        expect((saveAsModel.layout as GridLayoutKind).spec.items).toEqual([]);
        expect(saveAsModel.variables).toEqual([]);
      });

      it('should preserve visualization config', () => {
        const dashboardWithVizConfig = setupV2({
          elements: {
            'panel-1': {
              kind: 'Panel',
              spec: {
                ...defaultPanelSpec(),
                id: 1,
                title: 'Panel 1',
                vizConfig: {
                  kind: 'graph',
                  spec: {
                    fieldConfig: {
                      defaults: { custom: { lineWidth: 2 } },
                      overrides: [],
                    },
                    options: { legend: { show: true } },
                    pluginVersion: '1.0.0',
                  },
                },
              },
            },
          },
        });

        const saveAsModel = serializer.getSaveAsModel(dashboardWithVizConfig, baseOptions);

        const panelSpec = saveAsModel.elements['panel-1'].spec as PanelSpec;
        expect(panelSpec.vizConfig).toMatchObject({
          kind: 'graph',
          spec: {
            fieldConfig: {
              defaults: { custom: { lineWidth: 2 } },
              overrides: [],
            },
            options: { legend: { show: true } },
            pluginVersion: '1.0.0',
          },
        });
      });
    });
  });

  describe('onSaveComplete', () => {
    it('should set the initialSaveModel correctly', () => {
      const serializer = new V2DashboardSerializer();
      const saveModel = defaultDashboardV2Spec();
      const response = {
        id: 1,
        uid: 'aa',
        slug: 'slug',
        url: 'url',
        version: 2,
        status: 'status',
      };

      serializer.onSaveComplete(saveModel, response);

      expect(serializer.initialSaveModel).toEqual({
        ...saveModel,
      });
    });

    it('should allow retrieving snapshot url', () => {
      const serializer = new V2DashboardSerializer();
      serializer.metadata = {
        name: 'dashboard-test',
        resourceVersion: '1',
        creationTimestamp: '2023-01-01T00:00:00Z',
        annotations: {
          [AnnoKeyDashboardSnapshotOriginalUrl]: 'originalUrl/snapshot',
        },
      };

      expect(serializer.getSnapshotUrl()).toBe('originalUrl/snapshot');
    });
  });
});

function setup(override: Partial<Dashboard> = {}) {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [
        {
          id: 1,
          title: 'Panel 1',
          type: 'text',
        },
      ],
      version: 10,
      templating: {
        list: [
          {
            name: 'app',
            type: 'custom',
            current: {
              text: 'app1',
              value: 'app1',
            },
          },
        ],
      },
      ...override,
    },
    meta: {},
  });

  const initialSaveModel = transformSceneToSaveModel(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  return dashboard;
}

function setupV2(spec?: Partial<DashboardV2Spec>) {
  const dashboard = transformSaveModelSchemaV2ToScene({
    kind: 'DashboardWithAccessInfo',
    spec: {
      ...defaultDashboardV2Spec(),
      title: 'hello',
      timeSettings: {
        ...defaultTimeSettingsSpec(),
        autoRefresh: '10s',
        from: 'now-1h',
        to: 'now',
      },
      elements: {
        'panel-1': {
          kind: 'Panel',
          spec: {
            ...defaultPanelSpec(),
            id: 1,
            title: 'Panel 1',
          },
        },
      },
      layout: {
        kind: 'GridLayout',
        spec: {
          items: [
            {
              kind: 'GridLayoutItem',
              spec: {
                x: 0,
                y: 0,
                width: 12,
                height: 8,
                element: {
                  kind: 'ElementReference',
                  name: 'panel-1',
                },
              },
            },
          ],
        },
      },
      variables: [
        {
          kind: 'CustomVariable',
          spec: {
            name: 'app',
            label: 'Query Variable',
            description: 'A query variable',
            skipUrlSync: false,
            hide: 'dontHide',
            options: [],
            multi: false,
            current: {
              text: 'app1',
              value: 'app1',
            },
            query: 'app1',
            allValue: '',
            includeAll: false,
          },
        },
      ],
      ...spec,
    },
    apiVersion: 'v1',
    metadata: {
      name: 'dashboard-test',
      resourceVersion: '1',
      creationTimestamp: '2023-01-01T00:00:00Z',
    },
    access: {
      canEdit: true,
      canSave: true,
      canStar: true,
      canShare: true,
    },
  });

  const initialSaveModel = transformSceneToSaveModelSchemaV2(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  return dashboard;
}
