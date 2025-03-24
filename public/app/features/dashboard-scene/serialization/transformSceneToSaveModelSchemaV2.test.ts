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
} from '@grafana/scenes';
import {
  DashboardCursorSync as DashboardCursorSyncV1,
  VariableHide as VariableHideV1,
  VariableSort as VariableSortV1,
} from '@grafana/schema/dist/esm/index.gen';

import {
  GridLayoutSpec,
  ResponsiveGridLayoutSpec,
  RowsLayoutSpec,
  TabsLayoutSpec,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0';
import { DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { ResponsiveGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { ResponsiveGridLayout } from '../scene/layout-responsive-grid/ResponsiveGridLayout';
import { ResponsiveGridLayoutManager } from '../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

import { getPersistedDSForQuery, transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

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
            meta: { id: 'loki' },
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

  describe('getPersistedDSForQuery', () => {
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
      const resultA = getPersistedDSForQuery(queryWithoutDS, queryRunner, dsReferencesMap);
      expect(resultA).toBeUndefined();

      // Test the query with DS originally - should return the original datasource
      const resultB = getPersistedDSForQuery(queryWithDS, queryRunner, dsReferencesMap);
      expect(resultB).toEqual({ uid: 'prometheus', type: 'prometheus' });

      // Test a query with no DS originally but not in the mapping - should get the runner's datasource
      const queryNotInMapping: SceneDataQuery = {
        refId: 'C',
        // No datasource, but not in mapping
      };
      const resultC = getPersistedDSForQuery(queryNotInMapping, queryRunner, dsReferencesMap);
      expect(resultC).toEqual({ uid: 'default-ds', type: 'default' });
    });
  });

  describe('getDatasourceForQueries', () => {
    it('should respect datasource reference mapping when determining which queries should have datasources saved', () => {
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
      const resultA = getPersistedDSForQuery(queryWithoutDS, queryRunner, dsReferencesMap);
      expect(resultA).toBeUndefined();

      // Test the query with DS originally - should return the original datasource
      const resultB = getPersistedDSForQuery(queryWithDS, queryRunner, dsReferencesMap);
      expect(resultB).toEqual({ uid: 'prometheus', type: 'prometheus' });

      // Test a query with no DS originally but not in the mapping - should get the runner's datasource
      const queryNotInMapping: SceneDataQuery = {
        refId: 'C',
        // No datasource, but not in mapping
      };
      const resultC = getPersistedDSForQuery(queryNotInMapping, queryRunner, dsReferencesMap);
      expect(resultC).toEqual({ uid: 'default-ds', type: 'default' });
    });
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
              layout: new ResponsiveGridLayoutManager({
                layout: new ResponsiveGridLayout({
                  children: [
                    new ResponsiveGridItem({
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
    expect(rowsLayout.rows[0].spec.layout.kind).toBe('ResponsiveGridLayout');
    const layout1 = rowsLayout.rows[0].spec.layout.spec as ResponsiveGridLayoutSpec;
    expect(layout1.items[0].kind).toBe('ResponsiveGridLayoutItem');

    expect(rowsLayout.rows[1].spec.layout.kind).toBe('GridLayout');
    const layout2 = rowsLayout.rows[1].spec.layout.spec as GridLayoutSpec;
    expect(layout2.items[0].kind).toBe('GridLayoutItem');
  });

  it('should transform scene with responsive grid layout to schema v2', () => {
    const scene = setupDashboardScene(
      getMinimalSceneState(
        new ResponsiveGridLayoutManager({
          layout: new ResponsiveGridLayout({
            autoRows: 'rowString',
            templateColumns: 'colString',
            children: [
              new ResponsiveGridItem({
                body: new VizPanel({}),
              }),
              new ResponsiveGridItem({
                body: new VizPanel({}),
              }),
            ],
          }),
        })
      )
    );
    const result = transformSceneToSaveModelSchemaV2(scene);
    expect(result.layout.kind).toBe('ResponsiveGridLayout');
    const respGridLayout = result.layout.spec as ResponsiveGridLayoutSpec;
    expect(respGridLayout.col).toBe('colString');
    expect(respGridLayout.row).toBe('rowString');
    expect(respGridLayout.items.length).toBe(2);
    expect(respGridLayout.items[0].kind).toBe('ResponsiveGridLayoutItem');
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
