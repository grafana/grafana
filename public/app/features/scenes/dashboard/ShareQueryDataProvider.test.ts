import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import {
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';

import { ShareQueryDataProvider } from './ShareQueryDataProvider';
import { activateFullSceneTree, getVizPanelKeyForPanelId } from './utils';

export class SceneDummyPanel extends SceneObjectBase<SceneObjectState> {}

describe('ShareQueryDataProvider', () => {
  it('Should find and subscribe to another VizPanels data provider', () => {
    const panel = new SceneDummyPanel({
      key: getVizPanelKeyForPanelId(2),
      $data: new ShareQueryDataProvider({
        query: { refId: 'A', panelId: 1 },
      }),
    });

    const sourceData = new SceneDataNode({
      data: {
        series: [],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        structureRev: 11,
      },
    });

    const scene = new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneDummyPanel({
            key: getVizPanelKeyForPanelId(1),
            $data: sourceData,
          }),
        }),
        new SceneFlexItem({ body: panel }),
      ],
    });

    activateFullSceneTree(scene);

    expect(sceneGraph.getData(panel).state.data?.structureRev).toBe(11);

    sourceData.setState({ data: { ...sourceData.state.data!, structureRev: 12 } });

    expect(sceneGraph.getData(panel).state.data?.structureRev).toBe(12);
  });
});
