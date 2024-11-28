import { cloneDeep } from 'lodash';

import { config } from '@grafana/runtime';
import { behaviors, sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/dashboard_api';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardLayoutManager } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
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

    // TODO: Variables
    // expect(scene.state?.$variables?.state.variables).toHaveLength(dash.variables.length);
    // expect(scene.state?.$variables?.getByName(dash.variables[0].spec.name)).toBeInstanceOf(QueryVariable);
    // expect(scene.state?.$variables?.getByName(dash.variables[1].spec.name)).toBeInstanceOf(TextBoxVariable); ...

    // TODO: Annotations
    // expect(scene.state.annotations).toHaveLength(dash.annotations.length);
    // expect(scene.state.annotations[0].text).toBe(dash.annotations[0].text); ...

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

    // FIXME: There is an error of data being undefined
    // expect(vizPanel.state.$data).toBeInstanceOf(SceneDataTransformer);
    // const dataTransformer = vizPanel.state.$data as SceneDataTransformer;
    // expect(dataTransformer.state.transformations).toEqual([{ id: 'transform1', options: {} }]);

    // expect(dataTransformer.state.$data).toBeInstanceOf(SceneQueryRunner);
    const queryRunner = getQueryRunnerFor(vizPanel);
    expect(queryRunner).toBeInstanceOf(SceneQueryRunner);
    expect(queryRunner?.state.datasource).toBeUndefined();
    // expect(queryRunner.state.queries).toEqual([{ query: 'test-query', datasource: { uid: 'datasource1', type: 'prometheus' } }]);
    // expect(queryRunner.state.maxDataPoints).toBe(100);
    // expect(queryRunner.state.cacheTimeout).toBe('1m');
    // expect(queryRunner.state.queryCachingTTL).toBe(60);
    // expect(queryRunner.state.minInterval).toBe('1m');
    // expect(queryRunner.state.dataLayerFilter?.panelId).toBe(1);

    // FIXME: Fix the key incompatibility since panel is not numeric anymore
    // expect(vizPanel.state.key).toBe(dash.elements['test-panel-uid'].spec.uid);

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
