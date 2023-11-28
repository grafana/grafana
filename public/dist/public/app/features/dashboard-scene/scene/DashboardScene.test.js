import { CoreApp } from '@grafana/data';
import { sceneGraph, SceneGridItem, SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardScene } from './DashboardScene';
describe('DashboardScene', () => {
    describe('DashboardSrv.getCurrent compatibility', () => {
        it('Should set to compatibility wrapper', () => {
            var _a;
            const scene = buildTestScene();
            scene.activate();
            expect((_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.uid).toBe('dash-1');
        });
    });
    describe('Editing and discarding', () => {
        describe('Given scene in edit mode', () => {
            let scene;
            beforeEach(() => {
                scene = buildTestScene();
                scene.onEnterEditMode();
            });
            it('Should set isEditing to true', () => {
                expect(scene.state.isEditing).toBe(true);
            });
            it('A change to griditem pos should set isDirty true', () => {
                const gridItem = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1');
                gridItem.setState({ x: 10, y: 0, width: 10, height: 10 });
                expect(scene.state.isDirty).toBe(true);
                // verify can discard change
                scene.onDiscard();
                const gridItem2 = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1');
                expect(gridItem2.state.x).toBe(0);
            });
        });
    });
    describe('Enriching data requests', () => {
        let scene;
        beforeEach(() => {
            scene = buildTestScene();
            scene.onEnterEditMode();
        });
        it('Should add app, uid, and panelId', () => {
            const queryRunner = sceneGraph.findObject(scene, (o) => o.state.key === 'data-query-runner');
            expect(scene.enrichDataRequest(queryRunner)).toEqual({
                app: CoreApp.Dashboard,
                dashboardUID: 'dash-1',
                panelId: 1,
            });
        });
    });
});
function buildTestScene() {
    const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new SceneGridLayout({
            children: [
                new SceneGridItem({
                    key: 'griditem-1',
                    x: 0,
                    body: new VizPanel({
                        title: 'Panel A',
                        key: 'panel-1',
                        pluginId: 'table',
                        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
                    }),
                }),
                new SceneGridItem({
                    body: new VizPanel({
                        title: 'Panel B',
                        key: 'panel-2',
                        pluginId: 'table',
                    }),
                }),
            ],
        }),
    });
    return scene;
}
//# sourceMappingURL=DashboardScene.test.js.map