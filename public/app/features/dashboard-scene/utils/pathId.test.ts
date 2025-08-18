import {
  LocalValueVariable,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { findVizPanelByPathId } from './pathId';

describe('findVizPanelByPathId', () => {
  it('should find correct panel', () => {
    const { scene, panel1, repeatedPanel } = buildTestScene();

    expect(findVizPanelByPathId(scene, 'panel-1')).toBe(panel1);
    expect(findVizPanelByPathId(scene, 'US$pod1$panel-2')).toBe(repeatedPanel);
  });

  it('should find correct pane with legacy number only', () => {
    const { scene, panel1 } = buildTestScene();

    expect(findVizPanelByPathId(scene, '1')).toBe(panel1);
    // This should not find anything
    expect(findVizPanelByPathId(scene, '1$panel-1')).toBe(null);
  });

  it('should include local and parent local variable value', () => {
    const { repeatedPanel } = buildTestScene();

    expect(getVizPanelPathId(repeatedPanel)).toBe('US$pod1$panel-2');
  });
});

function buildTestScene() {
  const panel1 = new VizPanel({
    title: 'Panel 1',
    pluginId: 'table',
    key: 'panel-1',
  });

  const repeatedPanel = new VizPanel({
    title: 'Panel 2',
    pluginId: 'table',
    key: 'panel-2',
    $variables: new SceneVariableSet({
      variables: [new LocalValueVariable({ name: 'pod', value: 'pod1', text: 'pod1' })],
    }),
  });

  const grid = new SceneGridLayout({
    children: [
      new SceneGridItem({
        key: 'grid-item-1',
        x: 0,
        y: 0,
        width: 24,
        height: 10,
        body: panel1,
      }),
      new SceneGridRow({
        key: 'row-1',
        x: 0,
        y: 10,
        width: 24,
        height: 1,
        $variables: new SceneVariableSet({
          variables: [new LocalValueVariable({ name: 'datacenter', value: 'US', text: 'US' })],
        }),
        children: [
          new SceneGridItem({
            key: 'grid-item-2',
            x: 0,
            y: 11,
            width: 24,
            height: 5,
            body: repeatedPanel,
          }),
        ],
      }),
    ],
  });

  const scene = new DashboardScene({
    title: 'My dashboard',
    uid: 'dash-1',
    tags: ['database', 'panel'],
    meta: {
      canEdit: true,
    },
    body: new DefaultGridLayoutManager({ grid }),
  });

  return { scene, panel1, repeatedPanel };
}
