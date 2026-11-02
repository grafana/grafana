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
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

// The real timeseries field config, so draw style and the axis switches run through their real processors
setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(getPanelPlugin({ id: 'timeseries' }).useFieldConfig(getGraphFieldConfig(defaultGraphConfig))),
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

function buildScene(fieldConfig: VizPanel['state']['fieldConfig'], variables: CustomVariable[]) {
  const panel = new VizPanel({
    title: 'Panel',
    pluginId: 'timeseries',
    key: 'panel-1',
    $data: new SceneQueryRunner({ datasource: { uid: 'ds1' }, queries: [{ refId: 'A' }] }),
    fieldConfig,
  });
  const scene = new DashboardScene(
    {
      title: 'Test dashboard',
      uid: 'test-uid',
      $variables: new SceneVariableSet({ variables }),
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    'v2'
  );
  return { panel, scene };
}

async function tick() {
  await new Promise((r) => setTimeout(r, 1));
}

function resolvedCustom(panel: VizPanel) {
  return panel.applyFieldConfig(sceneGraph.getData(panel).state.data!).series[0].fields[0].config.custom;
}

describe('Select and boolean field config expressions via varMappings (dashboard scene)', () => {
  it('switches the resolved draw style with the variable and falls back on an unmatched value', async () => {
    // CustomVariable.changeValueTo publishes the value change that clears VizPanel's field config cache
    const style = new CustomVariable({ name: 'style', query: 'line,bars,points,foo', value: 'bars', text: 'bars' });
    const { panel, scene } = buildScene(
      { defaults: { custom: { drawStyle: 'line' }, varMappings: { 'custom.drawStyle': '${style}' } }, overrides: [] },
      [style]
    );

    const deactivate = activateFullSceneTree(scene);
    await tick();

    expect(resolvedCustom(panel).drawStyle).toBe('bars');

    style.changeValueTo('points', 'points');
    await tick();
    expect(resolvedCustom(panel).drawStyle).toBe('points');

    style.changeValueTo('foo', 'foo');
    await tick();
    expect(resolvedCustom(panel).drawStyle).toBe('line');

    deactivate();
  });

  it('switches a boolean set by an override rule expression', async () => {
    const border = new CustomVariable({ name: 'b', query: 'true,false', value: 'true', text: 'true' });
    const { panel, scene } = buildScene(
      {
        defaults: { custom: { axisBorderShow: false } },
        overrides: [
          {
            matcher: { id: 'byName', options: 'value' },
            properties: [
              { id: 'custom.axisBorderShow', value: false },
              { id: 'varMappings.custom.axisBorderShow', value: '$b' },
            ],
          },
        ],
      },
      [border]
    );

    const deactivate = activateFullSceneTree(scene);
    await tick();

    expect(resolvedCustom(panel).axisBorderShow).toBe(true);

    border.changeValueTo('false', 'false');
    await tick();
    expect(resolvedCustom(panel).axisBorderShow).toBe(false);

    deactivate();
  });
});
