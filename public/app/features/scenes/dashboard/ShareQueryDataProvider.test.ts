import { SceneDataNode, SceneFlexItem, SceneFlexLayout, VizPanel } from '@grafana/scenes';

import { ShareQueryDataProvider } from './ShareQueryDataProvider';
import { getVizPanelKeyForPanelId } from './utils';

describe('ShareQueryDataProvider', () => {
  it('Should find and subscribe to another VizPanels data provider', () => {
    const scene = new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new VizPanel({
            key: getVizPanelKeyForPanelId(1),
            $data: new SceneDataNode({}),
          }),
        }),
        new SceneFlexItem({
          body: new VizPanel({
            key: getVizPanelKeyForPanelId(2),
            $data: new ShareQueryDataProvider({
              query: { refId: 'A', panelId: 1 },
            }),
          }),
        }),
      ],
    });
  });
});
