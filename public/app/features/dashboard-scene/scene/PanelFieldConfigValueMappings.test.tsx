import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  type PanelData,
  MappingType,
  getDefaultTimeRange,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { CustomVariable, SceneQueryRunner, SceneVariableSet, VizPanel, sceneGraph } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// The registry reads the flag when it's first built, so it's set before any test touches it
setTestFlags({ [FlagKeys.GrafanaPanelOptionInterpolation]: true });

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

setPluginImportUtils({
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
  // Scenes resolves the query runner's data source through the async API
  getDataSourceInstance: jest.fn().mockResolvedValue({ getRef: () => ({ uid: 'ds1' }) }),
}));

setRunRequest(
  jest.fn().mockReturnValue(
    of<PanelData>({
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      series: [
        toDataFrame({
          fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }],
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

function buildScene(panel: VizPanel, variables: SceneVariableSet, serializerVersion: 'v1' | 'v2' = 'v1') {
  return new DashboardScene(
    {
      title: 'Test dashboard',
      uid: 'test-uid',
      $variables: variables,
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    serializerVersion
  );
}

async function tick() {
  await new Promise((r) => setTimeout(r, 1));
}

describe('Variables in value mapping display texts (dashboard scene)', () => {
  it('shows the variable text in a display text and updates it on variable change', async () => {
    const variable = new CustomVariable({
      name: 'env',
      query: 'Production : prod, Staging : stage',
      value: 'prod',
      text: 'Production',
    });
    const panel = buildPanel({
      mappings: [
        {
          type: MappingType.ValueToText,
          options: { '1': { text: 'Up in $env', index: 0 }, '2': { text: '$5 off', index: 1 } },
        },
      ],
    });
    const scene = buildScene(panel, new SceneVariableSet({ variables: [variable] }));

    const deactivate = activateFullSceneTree(scene);
    await tick();

    const field = () => panel.applyFieldConfig(sceneGraph.getData(panel).state.data!).series[0].fields[0];

    expect(field().display!(1).text).toBe('Up in Production');
    // not a variable, so it shows as typed
    expect(field().display!(2).text).toBe('$5 off');

    variable.changeValueTo('stage', 'Staging');
    await tick();
    expect(field().display!(1).text).toBe('Up in Staging');

    deactivate();
  });
});
