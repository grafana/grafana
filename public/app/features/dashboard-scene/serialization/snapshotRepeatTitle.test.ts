import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('snapshot repeated panel titles (realistic, activated)', () => {
  it('bakes the display text (label) of a key:value variable, not the value', () => {
    // pod is a key:value custom variable: label "Bob"/"Rob", value "1"/"2".
    const pod = new CustomVariable({
      name: 'pod',
      query: 'Bob : 1, Rob : 2',
      isMulti: true,
      includeAll: true,
      value: ['1', '2'],
      text: ['Bob', 'Rob'],
    });

    const repeater = new DashboardGridItem({
      key: 'grid-item-1',
      variableName: 'pod',
      body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'pod = $pod' }),
    });

    const scene = new DashboardScene({
      title: 'Repeat',
      $variables: new SceneVariableSet({ variables: [pod] }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [repeater] }),
      }),
    });

    activateFullSceneTree(scene);

    // Sanity: the repeat produced clones with local variables carrying the label as text.
    expect(repeater.state.repeatedPanels?.length).toBe(1);

    const result = transformSceneToSaveModelSchemaV2(scene, true);
    const titles = Object.values(result.elements).map((e) => e.spec.title);

    expect(titles).toEqual(expect.arrayContaining(['pod = Bob', 'pod = Rob']));
    expect(titles).not.toContain('pod = 1');
    expect(titles).not.toContain('pod = 2');
  });
});
