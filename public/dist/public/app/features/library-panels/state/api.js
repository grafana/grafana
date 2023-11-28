import { __awaiter, __rest } from "tslib";
import { lastValueFrom } from 'rxjs';
import { defaultDashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LibraryElementKind, } from '../types';
export function getLibraryPanels({ searchString = '', perPage = 100, page = 1, excludeUid = '', sortDirection = '', typeFilter = [], folderFilterUIDs = [], } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = new URLSearchParams();
        params.append('searchString', searchString);
        params.append('sortDirection', sortDirection);
        params.append('typeFilter', typeFilter.join(','));
        params.append('folderFilterUIDs', folderFilterUIDs.join(','));
        params.append('excludeUid', excludeUid);
        params.append('perPage', perPage.toString(10));
        params.append('page', page.toString(10));
        params.append('kind', LibraryElementKind.Panel.toString(10));
        const { result } = yield getBackendSrv().get(`/api/library-elements?${params.toString()}`);
        return result;
    });
}
export function getLibraryPanel(uid, isHandled = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield lastValueFrom(getBackendSrv().fetch({
            method: 'GET',
            url: `/api/library-elements/${uid}`,
            showSuccessAlert: !isHandled,
            showErrorAlert: !isHandled,
        }));
        // kinda heavy weight migration process!!!
        const { result } = response.data;
        const dash = new DashboardModel(Object.assign(Object.assign({}, defaultDashboard), { schemaVersion: 35, panels: [result.model] }));
        const _a = dash.panels[0].getSaveModel(), { scopedVars } = _a, model = __rest(_a, ["scopedVars"]); // migrated panel
        dash.destroy(); // kill event listeners
        return Object.assign(Object.assign({}, result), { model });
    });
}
export function getLibraryPanelByName(name) {
    return __awaiter(this, void 0, void 0, function* () {
        const { result } = yield getBackendSrv().get(`/api/library-elements/name/${name}`);
        return result;
    });
}
export function addLibraryPanel(panelSaveModel, folderUid) {
    return __awaiter(this, void 0, void 0, function* () {
        const { result } = yield getBackendSrv().post(`/api/library-elements`, {
            folderUid,
            name: panelSaveModel.libraryPanel.name,
            model: panelSaveModel,
            kind: LibraryElementKind.Panel,
        });
        return result;
    });
}
export function updateLibraryPanel(panelSaveModel) {
    return __awaiter(this, void 0, void 0, function* () {
        const { libraryPanel } = panelSaveModel, model = __rest(panelSaveModel, ["libraryPanel"]);
        const { uid, name, version, folderUid } = libraryPanel;
        const kind = LibraryElementKind.Panel;
        const { result } = yield getBackendSrv().patch(`/api/library-elements/${uid}`, {
            folderUid,
            name,
            model,
            version,
            kind,
        });
        return result;
    });
}
export function deleteLibraryPanel(uid) {
    return getBackendSrv().delete(`/api/library-elements/${uid}`);
}
export function getLibraryPanelConnectedDashboards(libraryPanelUid) {
    return __awaiter(this, void 0, void 0, function* () {
        const { result } = yield getBackendSrv().get(`/api/library-elements/${libraryPanelUid}/connections`);
        return result;
    });
}
export function getConnectedDashboards(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const connections = yield getLibraryPanelConnectedDashboards(uid);
        if (connections.length === 0) {
            return [];
        }
        const searchHits = yield getBackendSrv().search({ dashboardUIDs: connections.map((c) => c.connectionUid) });
        return searchHits;
    });
}
//# sourceMappingURL=api.js.map