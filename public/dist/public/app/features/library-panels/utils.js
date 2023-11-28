import { __awaiter, __rest } from "tslib";
import { addLibraryPanel, updateLibraryPanel } from './state/api';
export function saveAndRefreshLibraryPanel(panel, folderUid) {
    return __awaiter(this, void 0, void 0, function* () {
        const panelSaveModel = toPanelSaveModel(panel);
        const savedPanel = yield saveOrUpdateLibraryPanel(panelSaveModel, folderUid);
        updatePanelModelWithUpdate(panel, savedPanel);
        return savedPanel;
    });
}
function toPanelSaveModel(panel) {
    let _a = panel.getSaveModel(), { scopedVars } = _a, panelSaveModel = __rest(_a, ["scopedVars"]);
    panelSaveModel = Object.assign({ libraryPanel: {
            name: panel.title,
            uid: undefined,
        } }, panelSaveModel);
    return panelSaveModel;
}
function updatePanelModelWithUpdate(panel, updated) {
    panel.restoreModel(Object.assign(Object.assign({}, updated.model), { configRev: 0, libraryPanel: updated, title: panel.title }));
    panel.hasSavedPanelEditChange = true;
    panel.refresh();
}
function saveOrUpdateLibraryPanel(panel, folderUid) {
    if (!panel.libraryPanel) {
        return Promise.reject();
    }
    if (panel.libraryPanel && panel.libraryPanel.uid === '') {
        return addLibraryPanel(panel, folderUid);
    }
    return updateLibraryPanel(panel);
}
//# sourceMappingURL=utils.js.map