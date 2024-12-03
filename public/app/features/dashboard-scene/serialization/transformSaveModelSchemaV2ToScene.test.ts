import { cloneDeep } from 'lodash';

import { config } from '@grafana/runtime';
import {
  behaviors,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  IntervalVariable,
  QueryVariable,
  TextBoxVariable,
  SceneDataTransformer,
  sceneGraph,
  SceneQueryRunner,
  GroupByVariable,
  AdHocFiltersVariable,
  SceneVariable,
  SceneVariableState,
} from '@grafana/scenes';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  GroupByVariableKind,
  IntervalVariableKind,
  QueryVariableKind,
  TextVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/dashboard_api';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardLayoutManager } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { transformSaveModelSchemaV2ToScene, TypedVariableModelV2 } from './transformSaveModelSchemaV2ToScene';
import { transformCursorSynctoEnum } from './transformToV2TypesUtils';

const defaultDashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'dashboard-uid',
    namespace: 'default',
    labels: {},
    resourceVersion: '',
    creationTimestamp: '',
  },
  spec: handyTestingSchema,
  access: {},
  apiVersion: 'v2',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn(),
  }),
}));

describe('transformSaveModelSchemaV2ToScene', () => {
  beforeAll(() => {
    config.featureToggles.groupByVariable = true;
  });

  afterAll(() => {
    config.featureToggles.groupByVariable = false;
  });

  it('should initialize the DashboardScene with the model state', () => {
    const scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
    const dashboardControls = scene.state.controls!;
    const dash = defaultDashboard.spec;

    expect(scene.state.uid).toEqual(defaultDashboard.metadata.name);
    expect(scene.state.title).toEqual(dash.title);
    expect(scene.state.description).toEqual(dash.description);
    expect(scene.state.editable).toEqual(dash.editable);
    expect(scene.state.preload).toEqual(false);
    expect(scene.state.version).toEqual(dash.schemaVersion);
    expect(scene.state.tags).toEqual(dash.tags);

    const liveNow = scene.state.$behaviors?.find((b) => b instanceof behaviors.LiveNowTimer);
    expect(liveNow?.state.enabled).toEqual(dash.liveNow);

    const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);
    expect(transformCursorSynctoEnum(cursorSync?.state.sync)).toEqual(dash.cursorSync);

    // Dashboard links
    expect(scene.state.links).toHaveLength(dash.links.length);
    expect(scene.state.links![0].title).toBe(dash.links[0].title);

    // Time settings
    const time = dash.timeSettings;
    const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene)!;
    const timeRange = sceneGraph.getTimeRange(scene)!;

    // Time settings
    expect(refreshPicker.state.refresh).toEqual(time.autoRefresh);
    expect(refreshPicker.state.intervals).toEqual(time.autoRefreshIntervals);
    expect(timeRange?.state.fiscalYearStartMonth).toEqual(dash.timeSettings.fiscalYearStartMonth);
    expect(timeRange?.state.value.raw).toEqual({ from: dash.timeSettings.from, to: dash.timeSettings.to });
    expect(dashboardControls.state.hideTimeControls).toEqual(dash.timeSettings.hideTimepicker);
    expect(timeRange?.state.UNSAFE_nowDelay).toEqual(dash.timeSettings.nowDelay);
    expect(timeRange?.state.timeZone).toEqual(dash.timeSettings.timezone);
    expect(timeRange?.state.weekStart).toEqual(dash.timeSettings.weekStart);
    expect(dashboardControls).toBeDefined();
    expect(dashboardControls.state.refreshPicker.state.intervals).toEqual(time.autoRefreshIntervals);
    expect(dashboardControls.state.hideTimeControls).toBe(time.hideTimepicker);

    // Variables
    const variables = scene.state?.$variables;
    expect(variables?.state.variables).toHaveLength(dash.variables.length);
    validateVariable({
      sceneVariable: variables?.state.variables[0],
      variableKind: dash.variables[0] as QueryVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: QueryVariable,
      index: 0,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[1],
      variableKind: dash.variables[1] as CustomVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: CustomVariable,
      index: 1,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[2],
      variableKind: dash.variables[2] as DatasourceVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: DataSourceVariable,
      index: 2,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[3],
      variableKind: dash.variables[3] as ConstantVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: ConstantVariable,
      index: 3,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[4],
      variableKind: dash.variables[4] as IntervalVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: IntervalVariable,
      index: 4,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[5],
      variableKind: dash.variables[5] as TextVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: TextBoxVariable,
      index: 5,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[6],
      variableKind: dash.variables[6] as GroupByVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: GroupByVariable,
      index: 6,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[7],
      variableKind: dash.variables[7] as AdhocVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: AdHocFiltersVariable,
      index: 7,
    });

    // Annotations
    expect(scene.state.$data).toBeInstanceOf(DashboardDataLayerSet);
    const dataLayers = scene.state.$data as DashboardDataLayerSet;
    expect(dataLayers.state.annotationLayers).toHaveLength(dash.annotations.length);
    expect(dataLayers.state.annotationLayers[0].state.name).toBe(dash.annotations[0].spec.name);
    expect(dataLayers.state.annotationLayers[0].state.isEnabled).toBe(dash.annotations[0].spec.enable);
    expect(dataLayers.state.annotationLayers[0].state.isHidden).toBe(dash.annotations[0].spec.hide);

    // Enabled
    expect(dataLayers.state.annotationLayers[1].state.name).toBe(dash.annotations[1].spec.name);
    expect(dataLayers.state.annotationLayers[1].state.isEnabled).toBe(dash.annotations[1].spec.enable);
    expect(dataLayers.state.annotationLayers[1].state.isHidden).toBe(dash.annotations[1].spec.hide);

    // Disabled
    expect(dataLayers.state.annotationLayers[2].state.name).toBe(dash.annotations[2].spec.name);
    expect(dataLayers.state.annotationLayers[2].state.isEnabled).toBe(dash.annotations[2].spec.enable);
    expect(dataLayers.state.annotationLayers[2].state.isHidden).toBe(dash.annotations[2].spec.hide);

    // Hidden
    expect(dataLayers.state.annotationLayers[3].state.name).toBe(dash.annotations[3].spec.name);
    expect(dataLayers.state.annotationLayers[3].state.isEnabled).toBe(dash.annotations[3].spec.enable);
    expect(dataLayers.state.annotationLayers[3].state.isHidden).toBe(dash.annotations[3].spec.hide);

    // To be implemented
    // expect(timePicker.state.ranges).toEqual(dash.timeSettings.quickRanges);

    // VizPanel
    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels).toHaveLength(1);
    const vizPanel = vizPanels[0];
    expect(vizPanel.state.title).toBe(dash.elements['test-panel-uid'].spec.title);
    expect(vizPanel.state.description).toBe(dash.elements['test-panel-uid'].spec.description);
    expect(vizPanel.state.pluginId).toBe(dash.elements['test-panel-uid'].spec.vizConfig.kind);
    expect(vizPanel.state.pluginVersion).toBe(dash.elements['test-panel-uid'].spec.vizConfig.spec.pluginVersion);
    expect(vizPanel.state.options).toEqual(dash.elements['test-panel-uid'].spec.vizConfig.spec.options);
    expect(vizPanel.state.fieldConfig).toEqual(dash.elements['test-panel-uid'].spec.vizConfig.spec.fieldConfig);

    expect(vizPanel.state.$data).toBeInstanceOf(SceneDataTransformer);
    const dataTransformer = vizPanel.state.$data as SceneDataTransformer;
    expect(dataTransformer.state.transformations[0]).toEqual(
      dash.elements['test-panel-uid'].spec.data.spec.transformations[0].spec
    );

    expect(dataTransformer.state.$data).toBeInstanceOf(SceneQueryRunner);
    const queryRunner = getQueryRunnerFor(vizPanel)!;
    expect(queryRunner).toBeInstanceOf(SceneQueryRunner);
    expect(queryRunner.state.queries).toEqual([
      { datasource: { type: 'prometheus', uid: 'datasource1' }, expr: 'test-query', hide: false, refId: 'A' },
    ]);
    expect(queryRunner.state.maxDataPoints).toBe(100);
    expect(queryRunner.state.cacheTimeout).toBe('1m');
    expect(queryRunner.state.queryCachingTTL).toBe(60);
    expect(queryRunner.state.minInterval).toBe('1m');
    // FIXME: This is asking for a number as panel ID but here the uid of a panel is string
    // expect(queryRunner.state.dataLayerFilter?.panelId).toBe(0);

    // FIXME: Fix the key incompatibility since panel is not numeric anymore
    expect(vizPanel.state.key).toBe(dash.elements['test-panel-uid'].spec.uid);

    // FIXME: Tests for layout
  });

  it('should set panel ds if it is mixed DS', () => {
    const dashboard = cloneDeep(defaultDashboard);
    dashboard.spec.elements['test-panel-uid'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        datasource: {
          type: 'graphite',
          uid: 'datasource1',
        },
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.type).toBe('mixed');
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.uid).toBe(MIXED_DATASOURCE_NAME);
  });

  it('should set panel ds as undefined if it is not mixed DS', () => {
    const dashboard = cloneDeep(defaultDashboard);
    dashboard.spec.elements['test-panel-uid'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        datasource: {
          type: 'prometheus',
          uid: 'datasource1',
        },
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource).toBeUndefined();
  });

  it('should set panel ds as mixed if one ds is undefined', () => {
    const dashboard = cloneDeep(defaultDashboard);

    dashboard.spec.elements['test-panel-uid'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.type).toBe('mixed');
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.uid).toBe(MIXED_DATASOURCE_NAME);
  });
});

type SceneVariableConstructor<T extends SceneVariable<SceneVariableState>> = new (
  initialState: Partial<SceneVariableState>
) => T;

interface VariableValidation<T extends TypedVariableModelV2> {
  sceneVariable: SceneVariable<SceneVariableState> | undefined;
  variableKind: T;
  scene: DashboardScene;
  dashSpec: DashboardV2Spec;
  sceneVariableClass: SceneVariableConstructor<SceneVariable<SceneVariableState>>;
  index: number;
}

function validateVariable<T extends TypedVariableModelV2>({
  sceneVariable,
  variableKind,
  scene,
  dashSpec,
  sceneVariableClass,
  index,
}: VariableValidation<T>) {
  if (variableKind.kind === 'AdhocVariable' && sceneVariable instanceof AdHocFiltersVariable) {
    expect(sceneVariable).toBeInstanceOf(AdHocFiltersVariable);
    expect(scene.state?.$variables?.getByName(dashSpec.variables[index].spec.name)?.getValue()).toBe(
      `${variableKind.spec.filters[0].key}="${variableKind.spec.filters[0].value}"`
    );
    expect(sceneVariable?.state.datasource).toEqual(variableKind.spec.datasource);
  } else if (variableKind.kind !== 'AdhocVariable') {
    expect(sceneVariable).toBeInstanceOf(sceneVariableClass);
    expect(scene.state?.$variables?.getByName(dashSpec.variables[index].spec.name)?.getValue()).toBe(
      variableKind.spec.current.value
    );
  }
  if (sceneVariable instanceof DataSourceVariable && variableKind.kind === 'DatasourceVariable') {
    expect(sceneVariable?.state.pluginId).toBe(variableKind.spec.pluginId);
  }
  if (sceneVariable instanceof QueryVariable && variableKind.kind === 'QueryVariable') {
    expect(sceneVariable?.state.datasource).toBe(variableKind.spec.datasource);
    expect(sceneVariable?.state.query).toBe(variableKind.spec.query);
  }
  if (sceneVariable instanceof GroupByVariable && variableKind.kind === 'CustomVariable') {
    expect(sceneVariable?.state.datasource).toBe(variableKind.spec.query);
  }
}
