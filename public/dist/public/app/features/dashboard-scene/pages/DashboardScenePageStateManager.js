import { __awaiter } from "tslib";
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getVizPanelKeyForPanelId, findVizPanelByKey } from '../utils/utils';
export class DashboardScenePageStateManager extends StateManagerBase {
    constructor() {
        super(...arguments);
        this.cache = {};
    }
    loadDashboard(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dashboard = yield this.loadScene(uid);
                dashboard.startUrlSync();
                this.setState({ dashboard: dashboard, isLoading: false });
            }
            catch (err) {
                this.setState({ isLoading: false, loadError: String(err) });
            }
        });
    }
    loadPanelEdit(uid, panelId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dashboard = yield this.loadScene(uid);
                const panel = findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(parseInt(panelId, 10)));
                if (!panel) {
                    this.setState({ isLoading: false, loadError: 'Panel not found' });
                    return;
                }
                const panelEditor = buildPanelEditScene(dashboard, panel);
                panelEditor.startUrlSync();
                this.setState({ isLoading: false, panelEditor });
            }
            catch (err) {
                this.setState({ isLoading: false, loadError: String(err) });
            }
        });
    }
    loadScene(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const fromCache = this.cache[uid];
            if (fromCache) {
                return fromCache;
            }
            this.setState({ isLoading: true });
            const rsp = yield dashboardLoaderSrv.loadDashboard('db', '', uid);
            if (rsp.dashboard) {
                const scene = transformSaveModelToScene(rsp);
                this.cache[uid] = scene;
                return scene;
            }
            throw new Error('Dashboard not found');
        });
    }
    clearState() {
        getDashboardSrv().setCurrent(undefined);
        this.setState({ dashboard: undefined, loadError: undefined, isLoading: false, panelEditor: undefined });
    }
}
let stateManager = null;
export function getDashboardScenePageStateManager() {
    if (!stateManager) {
        stateManager = new DashboardScenePageStateManager({});
    }
    return stateManager;
}
//# sourceMappingURL=DashboardScenePageStateManager.js.map