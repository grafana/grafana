import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  type PanelData,
  ThresholdsMode,
  getDefaultTimeRange,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import {
  ConstantVariable,
  CustomVariable,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { invalidateFieldConfigCacheOnVariableChange } from './invalidateFieldConfigCacheOnVariableChange';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// use the real standard field config registry so min/max/thresholds run through the real processors
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

setPluginImportUtils({
  // useFieldConfig() pulls in the standard field config properties (min/max/thresholds)
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({}).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({ getRef: () => ({ uid: 'ds1' }) }),
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
}));

setRunRequest(
  jest.fn().mockReturnValue(
    of<PanelData>({
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      series: [
        toDataFrame({
          fields: [{ name: 'value', type: FieldType.number, values: [1, 50, 100] }],
        }),
      ],
    })
  )
);

function buildPanel(fieldConfigDefaults: VizPanel['state']['fieldConfig']['defaults']) {
  return new VizPanel({
    title: 'Panel',
    pluginId: 'timeseries',
    key: 'panel-1',
    $data: new SceneQueryRunner({
      datasource: { uid: 'ds1' },
      queries: [{ refId: 'A' }],
    }),
    fieldConfig: { defaults: fieldConfigDefaults, overrides: [] },
  });
}

function buildScene(panel: VizPanel, variables: SceneVariableSet) {
  return new DashboardScene({
    title: 'Test dashboard',
    uid: 'test-uid',
    $variables: variables,
    $behaviors: [invalidateFieldConfigCacheOnVariableChange],
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
}

async function tick() {
  await new Promise((r) => setTimeout(r, 1));
}

describe('Variables in panel thresholds and min/max (dashboard scene)', () => {
  it('interpolates variables through the real sceneGraph.interpolate path and updates on variable change', async () => {
    const warnVariable = new CustomVariable({ name: 'warn', query: '80,85', value: '80', text: '80' });
    const panel = buildPanel({
      min: '$minVar',
      max: '$doesNotExist',
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 90, color: 'red' },
          { value: '$warn', color: 'orange' },
        ],
      },
    });
    const scene = buildScene(
      panel,
      new SceneVariableSet({
        variables: [warnVariable, new ConstantVariable({ name: 'minVar', value: '10' })],
      })
    );

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const data = sceneGraph.getData(panel).state.data!;
    expect(data.series).toHaveLength(1);

    const processed = panel.applyFieldConfig(data);
    const config = processed.series[0].fields[0].config;

    expect(config.min).toBe(10);
    // unknown variable leaves max unset (auto)
    expect(config.max).toBeUndefined();
    // interpolated and re-sorted ascending, base step first
    expect(config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 80, color: 'orange' },
      { value: 90, color: 'red' },
    ]);

    // changing the variable value must re-process the field config even though the data is unchanged
    warnVariable.changeValueTo('85', '85');
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    expect(reprocessed.series[0].fields[0].config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 85, color: 'orange' },
      { value: 90, color: 'red' },
    ]);

    deactivate();
  });

  it('drops threshold steps and unsets min for multi-value variables with more than one selection', async () => {
    const multiVariable = new CustomVariable({
      name: 'multi',
      query: '1,2,3',
      isMulti: true,
      value: ['1', '2'],
      text: ['1', '2'],
    });
    const panel = buildPanel({
      min: '$multi',
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: '$multi', color: 'red' },
          { value: 50, color: 'orange' },
        ],
      },
    });
    const scene = buildScene(panel, new SceneVariableSet({ variables: [multiVariable] }));

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const processed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    const config = processed.series[0].fields[0].config;

    expect(config.min).toBeUndefined();
    expect(config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 50, color: 'orange' },
    ]);

    // narrowing the selection to a single value makes the variable valid again
    multiVariable.changeValueTo(['2'], ['2']);
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    const newConfig = reprocessed.series[0].fields[0].config;

    expect(newConfig.min).toBe(2);
    expect(newConfig.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 2, color: 'red' },
      { value: 50, color: 'orange' },
    ]);

    deactivate();
  });
});
