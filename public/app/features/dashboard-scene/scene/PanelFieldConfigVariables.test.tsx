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
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// use the real standard field config registry so thresholds run through the real processor
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

setPluginImportUtils({
  // useFieldConfig() pulls in the standard field config properties (incl. thresholds)
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
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
}

async function tick() {
  await new Promise((r) => setTimeout(r, 1));
}

describe('Variables in panel threshold steps (dashboard scene)', () => {
  it('resolves valueExpr through the real sceneGraph.interpolate path and updates on variable change', async () => {
    const warnVariable = new CustomVariable({ name: 'warn', query: '80,85', value: '80', text: '80' });
    const panel = buildPanel({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 90, color: 'red' },
          { value: 40, valueExpr: '$warn', color: 'orange' },
          { value: 95, valueExpr: '$doesNotExist', color: 'blue' },
        ],
      },
    });
    const scene = buildScene(
      panel,
      new SceneVariableSet({
        variables: [warnVariable, new ConstantVariable({ name: 'unrelated', value: '10' })],
      })
    );

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const data = sceneGraph.getData(panel).state.data!;
    expect(data.series).toHaveLength(1);

    const processed = panel.applyFieldConfig(data);
    const config = processed.series[0].fields[0].config;

    // $warn resolved to 80, the unknown variable fell back to 95,
    // re-sorted ascending with the base step first, valueExpr stripped
    expect(config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 80, color: 'orange' },
      { value: 90, color: 'red' },
      { value: 95, color: 'blue' },
    ]);

    // changing the variable must re-process the field config even though the data is unchanged
    warnVariable.changeValueTo('85', '85');
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    expect(reprocessed.series[0].fields[0].config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 85, color: 'orange' },
      { value: 90, color: 'red' },
      { value: 95, color: 'blue' },
    ]);

    deactivate();
  });

  it('falls back to the numeric value for multi-value variables with more than one selection', async () => {
    const multiVariable = new CustomVariable({
      name: 'multi',
      query: '1,2,3',
      isMulti: true,
      value: ['1', '2'],
      text: ['1', '2'],
    });
    const panel = buildPanel({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 90, valueExpr: '$multi', color: 'red' },
          { value: 50, color: 'orange' },
        ],
      },
    });
    const scene = buildScene(panel, new SceneVariableSet({ variables: [multiVariable] }));

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const processed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    const config = processed.series[0].fields[0].config;

    // more than one value selected: the step keeps its numeric fallback of 90
    expect(config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 50, color: 'orange' },
      { value: 90, color: 'red' },
    ]);

    // narrowing the selection to a single value makes the expression resolvable again
    multiVariable.changeValueTo(['2'], ['2']);
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    expect(reprocessed.series[0].fields[0].config.thresholds?.steps).toEqual([
      { value: -Infinity, color: 'green' },
      { value: 2, color: 'red' },
      { value: 50, color: 'orange' },
    ]);

    deactivate();
  });
});
