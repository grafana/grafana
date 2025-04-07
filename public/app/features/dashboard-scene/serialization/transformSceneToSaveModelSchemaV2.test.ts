import { VariableRefresh } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  behaviors,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneGridLayout,
  SceneGridRow,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VizPanel,
  SceneDataQuery,
  SceneQueryRunner,
  sceneUtils,
} from '@grafana/scenes';
import {
  DashboardCursorSync as DashboardCursorSyncV1,
  VariableHide as VariableHideV1,
  VariableSort as VariableSortV1,
} from '@grafana/schema/dist/esm/index.gen';
import {
  GridLayoutSpec,
  AutoGridLayoutSpec,
  RowsLayoutSpec,
  TabsLayoutSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { AutoGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { AutoGridLayout } from '../scene/layout-responsive-grid/ResponsiveGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

import {
  getPersistedDSFor,
  getElementDatasource,
  transformSceneToSaveModelSchemaV2,
  validateDashboardSchemaV2,
  getDataQueryKind,
} from './transformSceneToSaveModelSchemaV2';

// Mock dependencies
jest.mock('../utils/dashboardSceneGraph', () => {
  const original = jest.requireActual('../utils/dashboardSceneGraph');
  return {
    ...original,
    dashboardSceneGraph: {
      ...original.dashboardSceneGraph,
      getElementIdentifierForVizPanel: jest.fn().mockImplementation((panel) => {
        // Return the panel key if it exists, otherwise use panel-1 as default
        return panel?.state?.key || 'panel-1';
      }),
    },
  };
});

jest.mock('../utils/utils', () => {
  const original = jest.requireActual('../utils/utils');
  return {
    ...original,
    getDashboardSceneFor: jest.fn().mockImplementation(() => ({
      serializer: {
        getDSReferencesMapping: jest.fn().mockReturnValue({
          panels: new Map([['panel-1', new Set(['A'])]]),
          variables: new Set(),
          annotations: new Set(),
        }),
      },
    })),
  };
});

function setupDashboardScene(state: Partial<DashboardSceneState>): DashboardScene {
  return new DashboardScene(state);
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      settings: {
        defaultDatasource: 'loki',
        datasources: {
          Prometheus: {
            name: 'Prometheus',
            meta: { id: 'prometheus' },
            type: 'datasource',
          },
          '-- Grafana --': {
            name: 'Grafana',
            meta: { id: 'grafana' },
            type: 'datasource',
          },
          loki: {
            name: 'Loki',
            meta: {
              id: 'loki',
              name: 'Loki',
              type: 'datasource',
              info: { version: '1.0.0' },
              module: 'app/plugins/datasource/loki/module',
              baseUrl: '/plugins/loki',
            },
            type: 'datasource',
          },
        },
      },
    },
  },
}));

describe('transformSceneToSaveModelSchemaV2', () => {
  let dashboardScene: DashboardScene;
  let prevFeatureToggleValue: boolean;

  beforeAll(() => {
    prevFeatureToggleValue = !!config.featureToggles.groupByVariable;
    config.featureToggles.groupByVariable = true;
  });

  afterAll(() => {
    config.featureToggles.groupByVariable = prevFeatureToggleValue;
  });

  beforeEach(() => {
    // The intention is to have a complete dashboard scene
    // with all the possible properties set
    dashboardScene = setupDashboardScene({
      $data: new DashboardDataLayerSet({ annotationLayers: createAnnotationLayers() }),
      id: 1,
      title: 'Test Dashboard',
      description: 'Test Description',
      preload: true,
      tags: ['tag1', 'tag2'],
      uid: 'test-uid',
      version: 1,
      $timeRange: new SceneTimeRange({
        timeZone: 'UTC',
        from: 'now-1h',
        to: 'now',
        weekStart: 'monday',
        fiscalYearStartMonth: 1,
        UNSAFE_nowDelay: '1m',
        refreshOnActivate: {
          afterMs: 10,
          percent: 0.1,
        },
      }),
      controls: new DashboardControls({
        refreshPicker: new SceneRefreshPicker({
          refresh: '5s',
          intervals: ['5s', '10s', '30s'],
          autoEnabled: true,
          autoMinInterval: '5s',
          autoValue: '5s',
          isOnCanvas: true,
          primary: true,
          withText: true,
          minRefreshInterval: '5s',
        }),
        timePicker: new SceneTimePicker({
          isOnCanvas: true,
          hidePicker: true,
        }),
      }),
      links: [
        {
          title: 'Test Link',
          url: 'http://test.com',
          asDropdown: false,
          icon: '',
          includeVars: false,
          keepTime: false,
          tags: [],
          targetBlank: false,
          tooltip: '',
          type: 'link',
        },
      ],
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          isLazy: false,
          children: [
            new DashboardGridItem({
              y: 0,
              height: 10,
              body: new VizPanel({
                key: 'panel-1',
                pluginId: 'timeseries',
                title: 'Test Panel',
                titleItems: [
                  new VizPanelLinks({
                    rawLinks: [
                      { title: 'Test Link 1', url: 'http://test1.com', targetBlank: true },
                      { title: 'Test Link 2', url: 'http://test2.com' },
                    ],
                    menu: new VizPanelLinksMenu({}),
                  }),
                ],
                description: 'Test Description',
                hoverHeader: true,
                hoverHeaderOffset: 10,
                fieldConfig: { defaults: {}, overrides: [] },
                displayMode: 'transparent',
                pluginVersion: '7.0.0',
                $timeRange: new SceneTimeRange({
                  timeZone: 'UTC',
                  from: 'now-3h',
                  to: 'now',
                }),
              }),
              // Props related to repeatable panels
              // repeatedPanels?: VizPanel[],
              // variableName?: string,
              // itemHeight?: number,
              // repeatDirection?: RepeatDirection,
              // maxPerRow?: number,
            }),
            new SceneGridRow({
              key: 'panel-4',
              title: 'Test Row',
              y: 10,
              $behaviors: [new RowRepeaterBehavior({ variableName: 'customVar' })],
              children: [
                new DashboardGridItem({
                  y: 11,
                  body: new VizPanel({
                    key: 'panel-2',
                    pluginId: 'graph',
                    title: 'Test Panel 2',
                    description: 'Test Description 2',
                    fieldConfig: { defaults: {}, overrides: [] },
                    displayMode: 'transparent',
                    pluginVersion: '7.0.0',
                    $timeRange: new SceneTimeRange({
                      timeZone: 'UTC',
                      from: 'now-3h',
                      to: 'now',
                    }),
                  }),
                }),
              ],
            }),
          ],
        }),
      }),
      meta: {},
      editPane: new DashboardEditPane(),
      $behaviors: [
        new behaviors.CursorSync({
          sync: DashboardCursorSyncV1.Crosshair,
        }),
        new behaviors.LiveNowTimer({
          enabled: true,
        }),
      ],
      $variables: new SceneVariableSet({
        // Test each of the variables
        variables: [
          new QueryVariable({
            name: 'queryVar',
            label: 'Query Variable',
            description: 'A query variable',
            skipUrlSync: false,
            hide: VariableHideV1.hideLabel,
            value: 'value1',
            text: 'text1',
            query: {
              expr: 'label_values(node_boot_time_seconds)',
              refId: 'A',
            },
            definition: 'definition1',
            datasource: { uid: 'datasource1', type: 'prometheus' },
            sort: VariableSortV1.alphabeticalDesc,
            refresh: VariableRefresh.onDashboardLoad,
            regex: 'regex1',
            allValue: '*',
            includeAll: true,
            isMulti: true,
          }),
          new CustomVariable({
            name: 'customVar',
            label: 'Custom Variable',
            description: 'A custom variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: 'option1',
            text: 'option1',
            query: 'option1, option2',
            options: [
              { label: 'option1', value: 'option1' },
              { label: 'option2', value: 'option2' },
            ],
            isMulti: true,
            allValue: 'All',
            includeAll: true,
          }),
          new DataSourceVariable({
            name: 'datasourceVar',
            label: 'Datasource Variable',
            description: 'A datasource variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: 'value1',
            text: 'text1',
            regex: 'regex1',
            pluginId: 'datasource1',
            defaultOptionEnabled: true,
          }),
          new ConstantVariable({
            name: 'constantVar',
            label: 'Constant Variable',
            description: 'A constant variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: 'value4',
          }),
          new IntervalVariable({
            name: 'intervalVar',
            label: 'Interval Variable',
            description: 'An interval variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: '1m',
            intervals: ['1m', '5m', '10m'],
            autoEnabled: false,
            autoMinInterval: '1m',
            autoStepCount: 10,
          }),
          new TextBoxVariable({
            name: 'textVar',
            label: 'Text Variable',
            description: 'A text variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: 'value6',
          }),
          new GroupByVariable({
            name: 'groupByVar',
            label: 'Group By Variable',
            description: 'A group by variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            value: 'value7',
            text: 'text7',
            datasource: { uid: 'datasource2', type: 'prometheus' },
            defaultOptions: [
              { text: 'option1', value: 'option1' },
              { text: 'option2', value: 'option2' },
            ],
            isMulti: false,
            includeAll: false,
          }),
          new AdHocFiltersVariable({
            name: 'adhocVar',
            label: 'Adhoc Variable',
            description: 'An adhoc variable',
            skipUrlSync: false,
            hide: VariableHideV1.dontHide,
            datasource: { uid: 'datasource3', type: 'prometheus' },
            baseFilters: [
              {
                key: 'key1',
                operator: '=',
                value: 'value1',
                condition: 'AND',
              },
              {
                key: 'key2',
                operator: '=',
                value: 'value2',
                condition: 'OR',
              },
            ],
            filters: [
              {
                key: 'key3',
                operator: '=',
                value: 'value3',
                condition: 'AND',
              },
            ],
            defaultKeys: [
              {
                text: 'defaultKey1',
                value: 'defaultKey1',
                group: 'defaultGroup1',
                expandable: true,
              },
            ],
          }),
        ],
      }),
    });
  });

  it('should transform scene to save model schema v2', () => {
    const result = transformSceneToSaveModelSchemaV2(dashboardScene);
    expect(result).toMatchSnapshot();

    // Check that the annotation layers are correctly transformed
    expect(result.annotations).toHaveLength(3);
    // check annotation layer 3 with no datasource has the default datasource defined as type
    expect(result.annotations?.[2].spec.datasource?.type).toBe('loki');
  });

  it('should transform the minimum scene to save model schema v2', () => {
    const minimalScene = new DashboardScene({});

    expect(() => {
      transformSceneToSaveModelSchemaV2(minimalScene);
    }).not.toThrow();
  });

  describe('getPersistedDSFor query', () => {
    it('should respect datasource reference mapping when determining query datasource', () => {
      // Setup test data
      const queryWithoutDS: SceneDataQuery = {
        refId: 'A',
        // No datasource defined originally
      };
      const queryWithDS: SceneDataQuery = {
        refId: 'B',
        datasource: { uid: 'prometheus', type: 'prometheus' },
      };

      // Mock query runner with runtime-resolved datasource
      const queryRunner = new SceneQueryRunner({
        queries: [queryWithoutDS, queryWithDS],
        datasource: { uid: 'default-ds', type: 'default' },
      });

      // Get a reference to the DS references mapping
      const dsReferencesMap = new Set(['A']);

      // Test the query without DS originally - should return undefined
      const resultA = getPersistedDSFor(queryWithoutDS, dsReferencesMap, 'query', queryRunner);
      expect(resultA).toBeUndefined();

      // Test the query with DS originally - should return the original datasource
      const resultB = getPersistedDSFor(queryWithDS, dsReferencesMap, 'query', queryRunner);
      expect(resultB).toEqual({ uid: 'prometheus', type: 'prometheus' });

      // Test a query with no DS originally but not in the mapping - should get the runner's datasource
      const queryNotInMapping: SceneDataQuery = {
        refId: 'C',
        // No datasource, but not in mapping
      };
      const resultC = getPersistedDSFor(queryNotInMapping, dsReferencesMap, 'query', queryRunner);
      expect(resultC).toEqual({ uid: 'default-ds', type: 'default' });
    });
  });

  describe('getPersistedDSFor variable', () => {
    it('should respect datasource reference mapping when determining variable datasource', () => {
      // Setup test data - variable without datasource
      const variableWithoutDS = new QueryVariable({
        name: 'A',
        // No datasource defined originally
      });

      // Variable with datasource
      const variableWithDS = new QueryVariable({
        name: 'B',
        datasource: { uid: 'prometheus', type: 'prometheus' },
      });

      // Get a reference to the DS references mapping
      const dsReferencesMap = new Set(['A']);

      // Test the variable without DS originally - should return undefined
      const resultA = getPersistedDSFor(variableWithoutDS, dsReferencesMap, 'variable');
      expect(resultA).toBeUndefined();

      // Test the variable with DS originally - should return the original datasource
      const resultB = getPersistedDSFor(variableWithDS, dsReferencesMap, 'variable');
      expect(resultB).toEqual({ uid: 'prometheus', type: 'prometheus' });

      // Test a variable with no DS originally but not in the mapping - should get empty object
      const variableNotInMapping = new QueryVariable({
        name: 'C',
        // No datasource, but not in mapping
      });
      const resultC = getPersistedDSFor(variableNotInMapping, dsReferencesMap, 'variable');
      expect(resultC).toEqual({});
    });
  });

  describe('getDataQueryKind', () => {
    it('should preserve original query datasource type when available', () => {
      // 1. Test with a query that has its own datasource type
      const queryWithDS: SceneDataQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-1', type: 'prometheus' },
      };

      // Create a query runner with a different datasource type
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'default-ds', type: 'loki' },
        queries: [],
      });

      // Should use the query's own datasource type (prometheus)
      expect(getDataQueryKind(queryWithDS, queryRunner)).toBe('prometheus');
    });

    it('should use queryRunner datasource type as fallback when query has no datasource', () => {
      // 2. Test with a query that has no datasource
      const queryWithoutDS: SceneDataQuery = {
        refId: 'A',
      };

      // Create a query runner with a datasource
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'influxdb-1', type: 'influxdb' },
        queries: [],
      });

      // Should fall back to queryRunner's datasource type
      expect(getDataQueryKind(queryWithoutDS, queryRunner)).toBe('influxdb');
    });

    it('should fall back to default datasource when neither query nor queryRunner has datasource type', () => {
      // 3. Test with neither query nor queryRunner having a datasource type
      const queryWithoutDS: SceneDataQuery = {
        refId: 'A',
      };

      // Create a query runner with no datasource
      const queryRunner = new SceneQueryRunner({
        queries: [],
      });

      expect(getDataQueryKind(queryWithoutDS, queryRunner)).toBe('loki');

      // Also verify the function's behavior by checking the args
      expect(queryWithoutDS.datasource?.type).toBeUndefined(); // No query datasource
      expect(queryRunner.state.datasource?.type).toBeUndefined(); // No queryRunner datasource
    });
  });
});

describe('getElementDatasource', () => {
  it('should handle panel query datasources correctly', () => {
    // Create test elements
    const vizPanel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    const queryWithDS: SceneDataQuery = {
      refId: 'B',
      datasource: { uid: 'prometheus', type: 'prometheus' },
    };

    const queryWithoutDS: SceneDataQuery = {
      refId: 'A',
    };

    // Mock query runner
    const queryRunner = new SceneQueryRunner({
      queries: [queryWithoutDS, queryWithDS],
      datasource: { uid: 'default-ds', type: 'default' },
    });

    // Mock dsReferencesMapping
    const dsReferencesMapping = {
      panels: new Map(new Set([['panel-1', new Set<string>(['A'])]])),
      variables: new Set<string>(),
      annotations: new Set<string>(),
    };

    // Call the function with the panel and query with DS
    const resultWithDS = getElementDatasource(vizPanel, queryWithDS, 'panel', queryRunner, dsReferencesMapping);
    expect(resultWithDS).toEqual({ uid: 'prometheus', type: 'prometheus' });

    // Call the function with the panel and query without DS
    const resultWithoutDS = getElementDatasource(vizPanel, queryWithoutDS, 'panel', queryRunner, dsReferencesMapping);
    expect(resultWithoutDS).toBeUndefined();
  });

  it('should handle variable datasources correctly', () => {
    // Create a variable set
    const variableSet = new SceneVariableSet({
      variables: [
        new QueryVariable({
          name: 'A',
          // No datasource
        }),
        new QueryVariable({
          name: 'B',
          datasource: { uid: 'prometheus', type: 'prometheus' },
        }),
      ],
    });

    // Variable with DS
    const variableWithDS = variableSet.getByName('B');

    // Variable without DS
    const variableWithoutDS = variableSet.getByName('A');

    // Mock dsReferencesMapping
    const dsReferencesMapping = {
      panels: new Map(new Set([['panel-1', new Set<string>(['A'])]])),
      variables: new Set<string>(['A']),
      annotations: new Set<string>(),
    };

    // Call the function with variables
    if (variableWithDS && sceneUtils.isQueryVariable(variableWithDS)) {
      const resultWithDS = getElementDatasource(
        variableSet,
        variableWithDS,
        'variable',
        undefined,
        dsReferencesMapping
      );
      expect(resultWithDS).toEqual({ uid: 'prometheus', type: 'prometheus' });
    }

    if (variableWithoutDS && sceneUtils.isQueryVariable(variableWithoutDS)) {
      // Test with auto-assigned variable (in the mapping)
      const resultWithoutDS = getElementDatasource(variableSet, variableWithoutDS, 'variable');
      expect(resultWithoutDS).toEqual(undefined);
    }
  });

  it('should return undefined for non-query variables', () => {
    // Create a variable set with non-query variable
    const variableSet = new SceneVariableSet({
      variables: [
        new ConstantVariable({
          name: 'constant',
          value: 'value',
        }),
      ],
    });

    // Non-query variable
    const constantVar = variableSet.getByName('constant');

    // Call the function
    // @ts-expect-error
    const result = getElementDatasource(variableSet, constantVar, 'variable');
    expect(result).toBeUndefined();
  });

  it('should return undefined for non-query variables', () => {
    // Create a variable set with non-query variable types
    const variableSet = new SceneVariableSet({
      variables: [
        // Use TextBoxVariable which is not a QueryVariable
        new TextBoxVariable({
          name: 'textVar',
          value: 'text-value',
        }),
      ],
    });

    // Non-query variable - this is safe because getElementDatasource checks if it's a query variable
    const textVar = variableSet.getByName('textVar');

    // Call the function
    // @ts-expect-error
    const result = getElementDatasource(variableSet, textVar, 'variable');
    expect(result).toBeUndefined();
  });

  it('should handle invalid input combinations', () => {
    const vizPanel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    const variableSet = new SceneVariableSet({
      variables: [
        new QueryVariable({
          name: 'A',
        }),
      ],
    });

    const variable = variableSet.getByName('A');
    const query: SceneDataQuery = { refId: 'A' };

    if (variable && sceneUtils.isQueryVariable(variable)) {
      // Panel with variable
      expect(getElementDatasource(vizPanel, variable, 'panel')).toBeUndefined();
    }
    // Variable set with query
    expect(getElementDatasource(variableSet, query, 'variable')).toBeUndefined();
  });
});

function getMinimalSceneState(body: DashboardLayoutManager): Partial<DashboardSceneState> {
  return {
    id: 1,
    title: 'Test Dashboard',
    description: 'Test Description',
    preload: true,
    tags: ['tag1', 'tag2'],
    uid: 'test-uid',
    version: 1,

    controls: new DashboardControls({
      refreshPicker: new SceneRefreshPicker({
        refresh: '5s',
        intervals: ['5s', '10s', '30s'],
        autoEnabled: true,
        autoMinInterval: '5s',
        autoValue: '5s',
        isOnCanvas: true,
        primary: true,
        withText: true,
        minRefreshInterval: '5s',
      }),
      timePicker: new SceneTimePicker({
        isOnCanvas: true,
        hidePicker: true,
        quickRanges: [
          {
            display: 'Last 6 hours',
            from: 'now-6h',
            to: 'now',
          },
          {
            display: 'Last 3 days',
            from: 'now-3d',
            to: 'now',
          },
        ],
      }),
    }),

    $timeRange: new SceneTimeRange({
      timeZone: 'UTC',
      from: 'now-1h',
      to: 'now',
      weekStart: 'monday',
      fiscalYearStartMonth: 1,
      UNSAFE_nowDelay: '1m',
      refreshOnActivate: {
        afterMs: 10,
        percent: 0.1,
      },
    }),

    body,
  };
}

describe('dynamic layouts', () => {
  it('should transform scene with rows layout with default grids in rows to save model schema v2', () => {
    const scene = setupDashboardScene(
      getMinimalSceneState(
        new RowsLayoutManager({
          rows: [
            new RowItem({
              layout: new DefaultGridLayoutManager({
                grid: new SceneGridLayout({
                  children: [
                    new DashboardGridItem({
                      y: 0,
                      height: 10,
                      body: new VizPanel({}),
                    }),
                  ],
                }),
              }),
            }),
          ],
        })
      )
    );

    const result = transformSceneToSaveModelSchemaV2(scene);
    expect(result.layout.kind).toBe('RowsLayout');
    const rowsLayout = result.layout.spec as RowsLayoutSpec;
    expect(rowsLayout.rows.length).toBe(1);
    expect(rowsLayout.rows[0].kind).toBe('RowsLayoutRow');
    expect(rowsLayout.rows[0].spec.layout.kind).toBe('GridLayout');
  });

  it('should transform scene with rows layout with multiple rows with different grids to save model schema v2', () => {
    const scene = setupDashboardScene(
      getMinimalSceneState(
        new RowsLayoutManager({
          rows: [
            new RowItem({
              layout: new AutoGridLayoutManager({
                layout: new AutoGridLayout({
                  children: [
                    new AutoGridItem({
                      body: new VizPanel({}),
                    }),
                  ],
                }),
              }),
            }),
            new RowItem({
              layout: new DefaultGridLayoutManager({
                grid: new SceneGridLayout({
                  children: [
                    new DashboardGridItem({
                      y: 0,
                      height: 10,
                      body: new VizPanel({}),
                    }),
                  ],
                }),
              }),
            }),
          ],
        })
      )
    );

    const result = transformSceneToSaveModelSchemaV2(scene);
    expect(result.layout.kind).toBe('RowsLayout');
    const rowsLayout = result.layout.spec as RowsLayoutSpec;
    expect(rowsLayout.rows.length).toBe(2);
    expect(rowsLayout.rows[0].kind).toBe('RowsLayoutRow');
    expect(rowsLayout.rows[0].spec.layout.kind).toBe('AutoGridLayout');
    const layout1 = rowsLayout.rows[0].spec.layout.spec as AutoGridLayoutSpec;
    expect(layout1.items[0].kind).toBe('AutoGridLayoutItem');

    expect(rowsLayout.rows[1].spec.layout.kind).toBe('GridLayout');
    const layout2 = rowsLayout.rows[1].spec.layout.spec as GridLayoutSpec;
    expect(layout2.items[0].kind).toBe('GridLayoutItem');
  });

  it('should transform scene with auto grid layout to schema v2', () => {
    const scene = setupDashboardScene(
      getMinimalSceneState(
        new AutoGridLayoutManager({
          columnWidth: 100,
          rowHeight: 'standard',
          maxColumnCount: 4,
          fillScreen: true,
          layout: new AutoGridLayout({
            children: [
              new AutoGridItem({
                body: new VizPanel({}),
              }),
              new AutoGridItem({
                body: new VizPanel({}),
              }),
            ],
          }),
        })
      )
    );
    const result = transformSceneToSaveModelSchemaV2(scene);
    expect(result.layout.kind).toBe('AutoGridLayout');
    const respGridLayout = result.layout.spec as AutoGridLayoutSpec;
    expect(respGridLayout.columnWidthMode).toBe('custom');
    expect(respGridLayout.columnWidth).toBe(100);
    expect(respGridLayout.rowHeightMode).toBe('standard');
    expect(respGridLayout.rowHeight).toBeUndefined();
    expect(respGridLayout.maxColumnCount).toBe(4);
    expect(respGridLayout.fillScreen).toBe(true);
    expect(respGridLayout.items.length).toBe(2);
    expect(respGridLayout.items[0].kind).toBe('AutoGridLayoutItem');
  });

  it('should transform scene with tabs layout to schema v2', () => {
    const tabs = [
      new TabItem({
        layout: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                y: 0,
                height: 10,
                body: new VizPanel({}),
              }),
            ],
          }),
        }),
      }),
    ];

    const scene = setupDashboardScene(getMinimalSceneState(new TabsLayoutManager({ tabs })));
    const result = transformSceneToSaveModelSchemaV2(scene);
    expect(result.layout.kind).toBe('TabsLayout');
    const tabsLayout = result.layout.spec as TabsLayoutSpec;
    expect(tabsLayout.tabs.length).toBe(1);
    expect(tabsLayout.tabs[0].kind).toBe('TabsLayoutTab');
    expect(tabsLayout.tabs[0].spec.layout.kind).toBe('GridLayout');
  });
});

// Instead of reusing annotation layer objects, create a factory function to generate new ones each time
function createAnnotationLayers() {
  return [
    new DashboardAnnotationsDataLayer({
      key: 'layer1',
      query: {
        datasource: {
          type: 'grafana',
          uid: '-- Grafana --',
        },
        name: 'query1',
        enable: true,
        iconColor: 'red',
      },
      name: 'layer1',
      isEnabled: true,
      isHidden: false,
    }),
    new DashboardAnnotationsDataLayer({
      key: 'layer2',
      query: {
        datasource: {
          type: 'prometheus',
          uid: 'abcdef',
        },
        name: 'query2',
        enable: true,
        iconColor: 'blue',
      },
      name: 'layer2',
      isEnabled: true,
      isHidden: true,
    }),
    // this could happen if a dahboard was created from code and the datasource was not defined
    new DashboardAnnotationsDataLayer({
      key: 'layer3',
      query: {
        name: 'query3',
        enable: true,
        iconColor: 'green',
      },
      name: 'layer3',
      isEnabled: true,
      isHidden: true,
    }),
  ];
}

describe('validateDashboardSchemaV2', () => {
  const validDashboard = {
    title: 'Test Dashboard',
    timeSettings: {
      from: 'now-1h',
      to: 'now',
      autoRefresh: '5s',
      hideTimepicker: false,
      timezone: 'UTC',
      autoRefreshIntervals: ['5s', '10s', '30s'],
      quickRanges: [],
      weekStart: 'monday',
      nowDelay: '1m',
      fiscalYearStartMonth: 1,
    },
    variables: [],
    elements: {},
    annotations: [],
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [],
      },
    },
  };

  it('should validate a valid dashboard', () => {
    expect(validateDashboardSchemaV2(validDashboard)).toBe(true);
  });

  it('should throw error if dashboard is not an object', () => {
    expect(() => validateDashboardSchemaV2(null)).toThrow('Dashboard is not an object or is null');
    expect(() => validateDashboardSchemaV2(undefined)).toThrow('Dashboard is not an object or is null');
    expect(() => validateDashboardSchemaV2('string')).toThrow('Dashboard is not an object or is null');
    expect(() => validateDashboardSchemaV2(123)).toThrow('Dashboard is not an object or is null');
    expect(() => validateDashboardSchemaV2(true)).toThrow('Dashboard is not an object or is null');
    expect(() => validateDashboardSchemaV2([])).toThrow('Dashboard is not an object or is null');
  });

  it('should validate required properties', () => {
    const requiredProps = {
      title: 'Title is not a string',
      timeSettings: 'TimeSettings is not an object or is null',
      variables: 'Variables is not an array',
      elements: 'Elements is not an object or is null',
      annotations: 'Annotations is not an array',
      layout: 'Layout is not an object or is null',
    };

    for (const [prop, message] of Object.entries(requiredProps)) {
      const invalidDashboard = { ...validDashboard };
      delete invalidDashboard[prop as keyof typeof invalidDashboard];
      expect(() => validateDashboardSchemaV2(invalidDashboard)).toThrow(message);
    }
  });

  it('should validate timeSettings required properties', () => {
    const timeSettingsErrors = {
      from: 'From is not a string',
      to: 'To is not a string',
      autoRefresh: 'AutoRefresh is not a string',
      hideTimepicker: 'HideTimepicker is not a boolean',
    } as const;

    for (const [prop, message] of Object.entries(timeSettingsErrors)) {
      const invalidDashboard = {
        ...validDashboard,
        timeSettings: { ...validDashboard.timeSettings },
      };
      delete invalidDashboard.timeSettings[prop as keyof typeof invalidDashboard.timeSettings];
      expect(() => validateDashboardSchemaV2(invalidDashboard)).toThrow(message);
    }
  });

  it('should validate optional properties when present', () => {
    const invalidDashboard = {
      ...validDashboard,
      description: 123, // Should be string
      cursorSync: 'Invalid', // Should be one of ['Off', 'Crosshair', 'Tooltip']
      liveNow: 'true', // Should be boolean
      preload: 'true', // Should be boolean
      editable: 'true', // Should be boolean
      links: 'not-an-array', // Should be array
      tags: 'not-an-array', // Should be array
      id: 'not-a-number', // Should be number
    };

    expect(() => validateDashboardSchemaV2(invalidDashboard)).toThrow('Description is not a string');
    expect(() => validateDashboardSchemaV2({ ...validDashboard, cursorSync: 'Invalid' })).toThrow(
      'CursorSync is not a valid value'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, liveNow: 'true' })).toThrow('LiveNow is not a boolean');
    expect(() => validateDashboardSchemaV2({ ...validDashboard, preload: 'true' })).toThrow('Preload is not a boolean');
    expect(() => validateDashboardSchemaV2({ ...validDashboard, editable: 'true' })).toThrow(
      'Editable is not a boolean'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, links: 'not-an-array' })).toThrow(
      'Links is not an array'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, tags: 'not-an-array' })).toThrow(
      'Tags is not an array'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, id: 'not-a-number' })).toThrow('ID is not a number');
  });

  it('should validate optional timeSettings properties when present', () => {
    const invalidTimeSettings = {
      ...validDashboard.timeSettings,
      autoRefreshIntervals: 'not-an-array',
      timezone: 123,
      quickRanges: 'not-an-array',
      weekStart: 'invalid-day',
      nowDelay: 123,
      fiscalYearStartMonth: 'not-a-number',
    };

    expect(() => validateDashboardSchemaV2({ ...validDashboard, timeSettings: invalidTimeSettings })).toThrow(
      'AutoRefreshIntervals is not an array'
    );
    expect(() =>
      validateDashboardSchemaV2({ ...validDashboard, timeSettings: { ...validDashboard.timeSettings, timezone: 123 } })
    ).toThrow('Timezone is not a string');
    expect(() =>
      validateDashboardSchemaV2({
        ...validDashboard,
        timeSettings: { ...validDashboard.timeSettings, quickRanges: 'not-an-array' },
      })
    ).toThrow('QuickRanges is not an array');
    expect(() =>
      validateDashboardSchemaV2({
        ...validDashboard,
        timeSettings: { ...validDashboard.timeSettings, weekStart: 'invalid-day' },
      })
    ).toThrow('WeekStart should be one of "saturday", "sunday" or "monday"');
    expect(() =>
      validateDashboardSchemaV2({ ...validDashboard, timeSettings: { ...validDashboard.timeSettings, nowDelay: 123 } })
    ).toThrow('NowDelay is not a string');
    expect(() =>
      validateDashboardSchemaV2({
        ...validDashboard,
        timeSettings: { ...validDashboard.timeSettings, fiscalYearStartMonth: 'not-a-number' },
      })
    ).toThrow('FiscalYearStartMonth is not a number');
  });

  it('should validate layout kind and structure', () => {
    // Missing kind
    expect(() => validateDashboardSchemaV2({ ...validDashboard, layout: { spec: { items: [] } } })).toThrow(
      'Layout kind is required'
    );

    // Invalid GridLayout
    expect(() => validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'GridLayout' } })).toThrow(
      'Layout spec is not an object or is null'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'GridLayout', spec: {} } })).toThrow(
      'Layout spec items is not an array'
    );

    // Invalid RowsLayout
    expect(() => validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'RowsLayout' } })).toThrow(
      'Layout spec is not an object or is null'
    );
    expect(() => validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'RowsLayout', spec: {} } })).toThrow(
      'Layout spec items is not an array'
    );

    // Valid GridLayout
    expect(validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'GridLayout', spec: { items: [] } } })).toBe(
      true
    );

    // Valid RowsLayout
    expect(validateDashboardSchemaV2({ ...validDashboard, layout: { kind: 'RowsLayout', spec: { rows: [] } } })).toBe(
      true
    );
  });
});
