import { __awaiter } from "tslib";
import { backendSrv } from 'app/core/services/backend_srv';
import { getNewDashboardModelData, setDashboardToFetchFromLocalStorage, } from 'app/features/dashboard/state/initDashboard';
export var AddToDashboardError;
(function (AddToDashboardError) {
    AddToDashboardError["FETCH_DASHBOARD"] = "fetch-dashboard";
    AddToDashboardError["SET_DASHBOARD_LS"] = "set-dashboard-ls-error";
})(AddToDashboardError || (AddToDashboardError = {}));
function createDashboard() {
    const dto = getNewDashboardModelData();
    // getNewDashboardModelData adds by default the "add-panel" panel. We don't want that.
    dto.dashboard.panels = [];
    return dto;
}
export function setDashboardInLocalStorage(options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const panelType = getPanelType(options.queries, options.queryResponse);
        const panel = {
            targets: options.queries,
            type: panelType,
            title: 'New Panel',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            datasource: options.datasource,
        };
        let dto;
        if (options.dashboardUid) {
            try {
                dto = yield backendSrv.getDashboardByUid(options.dashboardUid);
            }
            catch (e) {
                throw AddToDashboardError.FETCH_DASHBOARD;
            }
        }
        else {
            dto = createDashboard();
        }
        dto.dashboard.panels = [panel, ...((_a = dto.dashboard.panels) !== null && _a !== void 0 ? _a : [])];
        try {
            setDashboardToFetchFromLocalStorage(dto);
        }
        catch (_b) {
            throw AddToDashboardError.SET_DASHBOARD_LS;
        }
    });
}
const isVisible = (query) => !query.hide;
const hasRefId = (refId) => (frame) => frame.refId === refId;
function getPanelType(queries, queryResponse) {
    var _a, _b, _c;
    for (const { refId } of queries.filter(isVisible)) {
        const hasQueryRefId = hasRefId(refId);
        if (queryResponse.flameGraphFrames.some(hasQueryRefId)) {
            return 'flamegraph';
        }
        if (queryResponse.graphFrames.some(hasQueryRefId)) {
            return 'timeseries';
        }
        if (queryResponse.logsFrames.some(hasQueryRefId)) {
            return 'logs';
        }
        if (queryResponse.nodeGraphFrames.some(hasQueryRefId)) {
            return 'nodeGraph';
        }
        if (queryResponse.traceFrames.some(hasQueryRefId)) {
            return 'traces';
        }
        if (queryResponse.customFrames.some(hasQueryRefId)) {
            // we will always have a custom frame and meta, it should never default to 'table' (but all paths must return a string)
            return (_c = (_b = (_a = queryResponse.customFrames.find(hasQueryRefId)) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationPluginId) !== null && _c !== void 0 ? _c : 'table';
        }
    }
    // falling back to table
    return 'table';
}
//# sourceMappingURL=addToDashboard.js.map