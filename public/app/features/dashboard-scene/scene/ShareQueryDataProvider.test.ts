import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import {
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';
import { getVizPanelKeyForPanelId } from '../utils/utils';

import { ShareQueryDataProvider } from './ShareQueryDataProvider';

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

  it('should find and update to another VizPanels data provider when query changed', () => {
    const sharedQuery = new ShareQueryDataProvider({
      query: { refId: 'A', panelId: 1 },
    });
    const panelWithSharedQuery = new SceneDummyPanel({
      key: getVizPanelKeyForPanelId(3),
      $data: sharedQuery,
    });

    const sourceData1 = new SceneDataNode({
      data: {
        series: [],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        structureRev: 1,
      },
    });

    const sourceData2 = new SceneDataNode({
      data: {
        series: [],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        structureRev: 100,
      },
    });

    const sourcePanel1 = new SceneDummyPanel({
      key: getVizPanelKeyForPanelId(1),
      $data: sourceData1,
    });

    const sourcePanel2 = new SceneDummyPanel({
      key: getVizPanelKeyForPanelId(2),
      $data: sourceData2,
    });

    const scene = new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: sourcePanel1,
        }),
        new SceneFlexItem({
          body: sourcePanel2,
        }),
        new SceneFlexItem({ body: panelWithSharedQuery }),
      ],
    });

    activateFullSceneTree(scene);

    expect(sceneGraph.getData(panelWithSharedQuery).state.data?.structureRev).toBe(1);

    sharedQuery.setState({
      query: {
        refId: 'A',
        panelId: 2,
      },
    });

    expect(sceneGraph.getData(panelWithSharedQuery).state.data?.structureRev).toBe(100);
    sourceData2.setState({ data: { ...sourceData2.state.data!, structureRev: 101 } });
    expect(sceneGraph.getData(panelWithSharedQuery).state.data?.structureRev).toBe(101);
  });
});
