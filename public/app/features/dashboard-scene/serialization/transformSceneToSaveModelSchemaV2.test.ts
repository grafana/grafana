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
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VizPanel,
} from '@grafana/scenes';
import {
  DashboardCursorSync as DashboardCursorSyncV1,
  VariableHide as VariableHideV1,
  VariableSort as VariableSortV1,
} from '@grafana/schema/dist/esm/index.gen';

import { DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

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
      $data: new DashboardDataLayerSet({ annotationLayers }),
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
          ],
        }),
      }),
      meta: {},
      editPane: new DashboardEditPane({}),
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
            query: 'query1',
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
});

const annotationLayer1 = new DashboardAnnotationsDataLayer({
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
});

const annotationLayer2 = new DashboardAnnotationsDataLayer({
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
});

// this could happen if a dahboard was created from code and the datasource was not defined
const annotationLayer3NoDsDefined = new DashboardAnnotationsDataLayer({
  key: 'layer3',
  query: {
    name: 'query3',
    enable: true,
    iconColor: 'green',
  },
  name: 'layer3',
  isEnabled: true,
  isHidden: true,
});

const annotationLayers = [annotationLayer1, annotationLayer2, annotationLayer3NoDsDefined];
