import { __awaiter } from "tslib";
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { locationService } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardScene } from './DashboardScene';
import { panelMenuBehavior } from './PanelMenuBehavior';
const mocks = {
    contextSrv: jest.mocked(contextSrv),
    getExploreUrl: jest.fn(),
};
jest.mock('app/core/utils/explore', () => (Object.assign(Object.assign({}, jest.requireActual('app/core/utils/explore')), { getExploreUrl: (options) => {
        return mocks.getExploreUrl(options);
    } })));
jest.mock('app/core/services/context_srv');
describe('panelMenuBehavior', () => {
    beforeAll(() => {
        locationService.push('/scenes/dashboard/dash-1?from=now-5m&to=now');
    });
    it('Given standard panel', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const { menu, panel } = yield buildTestScene({});
        Object.assign(panel, 'getPlugin', () => getPanelPlugin({}));
        mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
        mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));
        menu.activate();
        yield new Promise((r) => setTimeout(r, 1));
        expect((_a = menu.state.items) === null || _a === void 0 ? void 0 : _a.length).toBe(5);
        // verify view panel url keeps url params and adds viewPanel=<panel-key>
        expect((_b = menu.state.items) === null || _b === void 0 ? void 0 : _b[0].href).toBe('/scenes/dashboard/dash-1?from=now-5m&to=now&viewPanel=panel-12');
        // verify edit url keeps url time range
        expect((_c = menu.state.items) === null || _c === void 0 ? void 0 : _c[1].href).toBe('/scenes/dashboard/dash-1/panel-edit/12?from=now-5m&to=now');
        // verify share
        expect((_d = menu.state.items) === null || _d === void 0 ? void 0 : _d[2].text).toBe('Share');
        // verify explore url
        expect((_e = menu.state.items) === null || _e === void 0 ? void 0 : _e[3].href).toBe('/explore');
        // Verify explore url is called with correct arguments
        const getExploreArgs = mocks.getExploreUrl.mock.calls[0][0];
        expect(getExploreArgs.dsRef).toEqual({ uid: 'my-uid' });
        expect(getExploreArgs.queries).toEqual([{ query: 'buu', refId: 'A' }]);
        expect((_g = (_f = getExploreArgs.scopedVars) === null || _f === void 0 ? void 0 : _f.__sceneObject) === null || _g === void 0 ? void 0 : _g.value).toBe(panel);
        // verify inspect url keeps url params and adds inspect=<panel-key>
        expect((_h = menu.state.items) === null || _h === void 0 ? void 0 : _h[4].href).toBe('/scenes/dashboard/dash-1?from=now-5m&to=now&inspect=panel-12');
    }));
});
function buildTestScene(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const menu = new VizPanelMenu({
            $behaviors: [panelMenuBehavior],
        });
        const panel = new VizPanel({
            title: 'Panel A',
            pluginId: 'table',
            key: 'panel-12',
            menu,
            $data: new SceneQueryRunner({
                datasource: { uid: 'my-uid' },
                queries: [{ query: 'buu', refId: 'A' }],
            }),
        });
        const scene = new DashboardScene({
            title: 'hello',
            uid: 'dash-1',
            body: new SceneGridLayout({
                children: [
                    new SceneGridItem({
                        key: 'griditem-1',
                        x: 0,
                        y: 0,
                        width: 10,
                        height: 12,
                        body: panel,
                    }),
                ],
            }),
        });
        yield new Promise((r) => setTimeout(r, 1));
        return { scene, panel, menu };
    });
}
//# sourceMappingURL=PanelMenuBehavior.test.js.map