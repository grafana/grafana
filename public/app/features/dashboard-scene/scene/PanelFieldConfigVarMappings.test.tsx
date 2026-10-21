import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  type PanelData,
  getDefaultTimeRange,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { CustomVariable, SceneQueryRunner, SceneVariableSet, VizPanel, sceneGraph } from '@grafana/scenes';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// use the real standard field config registry so min/max/decimals run through the real
// numberOverrideProcessor, not a test double
standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

setPluginImportUtils({
  // useFieldConfig() pulls in the standard field config properties (incl. min/max/decimals)
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

describe('Variables in panel field config via varMappings (dashboard scene)', () => {
  it('resolves defaults.varMappings.min through the real sceneGraph.interpolate path and reacts to variable change', async () => {
    // CustomVariable rather than ConstantVariable + setState: only changeValueTo publishes the
    // SceneVariableValueChangedEvent that VizPanel's field config cache invalidation listens for.
    const varVariable = new CustomVariable({ name: 'myVar', query: '50,75', value: '50', text: '50' });
    const panel = buildPanel({
      min: 0,
      varMappings: { min: '$myVar' },
    });
    const scene = buildScene(panel, new SceneVariableSet({ variables: [varVariable] }));

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const data = sceneGraph.getData(panel).state.data!;
    expect(data.series).toHaveLength(1);

    const processed = panel.applyFieldConfig(data);
    const config = processed.series[0].fields[0].config;

    // $myVar resolved to 50, varMappings stripped from the resolved config
    expect(config.min).toEqual(50);
    expect(config.varMappings).toBeUndefined();

    // Changing the variable must re-process the field config even though the data is unchanged,
    // which relies on VizPanel clearing its field config cache on referenced variable changes.
    varVariable.changeValueTo('75', '75');
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    expect(reprocessed.series[0].fields[0].config.min).toEqual(75);

    deactivate();
  });

  it('falls back to the stored numeric value for a multi-value variable with more than one selection', async () => {
    const multiVariable = new CustomVariable({
      name: 'multi',
      query: '1,2,3',
      isMulti: true,
      value: ['1', '2'],
      text: ['1', '2'],
    });
    const panel = buildPanel({
      max: 100,
      varMappings: { max: '$multi' },
    });
    const scene = buildScene(panel, new SceneVariableSet({ variables: [multiVariable] }));

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const processed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    // more than one value selected: falls back to the stored numeric value, never a broken render
    expect(processed.series[0].fields[0].config.max).toEqual(100);

    // narrowing the selection to a single value makes the expression resolvable again
    multiVariable.changeValueTo(['2'], ['2']);
    await tick();

    const reprocessed = panel.applyFieldConfig(sceneGraph.getData(panel).state.data!);
    expect(reprocessed.series[0].fields[0].config.max).toEqual(2);

    deactivate();
  });
});
