import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { SceneDataNode, SceneFlexItem, SceneFlexLayout, sceneGraph, SceneObjectBase, } from '@grafana/scenes';
import { activateFullSceneTree } from '../utils/test-utils';
import { getVizPanelKeyForPanelId } from '../utils/utils';
import { ShareQueryDataProvider } from './ShareQueryDataProvider';
export class SceneDummyPanel extends SceneObjectBase {
}
describe('ShareQueryDataProvider', () => {
    it('Should find and subscribe to another VizPanels data provider', () => {
        var _a, _b;
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
        expect((_a = sceneGraph.getData(panel).state.data) === null || _a === void 0 ? void 0 : _a.structureRev).toBe(11);
        sourceData.setState({ data: Object.assign(Object.assign({}, sourceData.state.data), { structureRev: 12 }) });
        expect((_b = sceneGraph.getData(panel).state.data) === null || _b === void 0 ? void 0 : _b.structureRev).toBe(12);
    });
});
//# sourceMappingURL=ShareQueryDataProvider.test.js.map