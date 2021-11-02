import { __assign, __awaiter, __generator } from "tslib";
import { addLibraryPanel, updateLibraryPanel } from './state/api';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
export function createPanelLibraryErrorNotification(message) {
    return createErrorNotification(message);
}
export function createPanelLibrarySuccessNotification(message) {
    return createSuccessNotification(message);
}
export function toPanelModelLibraryPanel(libraryPanelDto) {
    var uid = libraryPanelDto.uid, name = libraryPanelDto.name, meta = libraryPanelDto.meta, version = libraryPanelDto.version;
    return { uid: uid, name: name, meta: meta, version: version };
}
export function saveAndRefreshLibraryPanel(panel, folderId) {
    return __awaiter(this, void 0, void 0, function () {
        var panelSaveModel, savedPanel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    panelSaveModel = toPanelSaveModel(panel);
                    return [4 /*yield*/, saveOrUpdateLibraryPanel(panelSaveModel, folderId)];
                case 1:
                    savedPanel = _a.sent();
                    updatePanelModelWithUpdate(panel, savedPanel);
                    return [2 /*return*/, savedPanel];
            }
        });
    });
}
function toPanelSaveModel(panel) {
    var panelSaveModel = panel.getSaveModel();
    panelSaveModel = __assign({ libraryPanel: {
            name: panel.title,
            uid: undefined,
        } }, panelSaveModel);
    return panelSaveModel;
}
function updatePanelModelWithUpdate(panel, updated) {
    panel.restoreModel(__assign(__assign({}, updated.model), { configRev: 0, libraryPanel: toPanelModelLibraryPanel(updated), title: panel.title }));
    panel.refresh();
}
function saveOrUpdateLibraryPanel(panel, folderId) {
    if (!panel.libraryPanel) {
        return Promise.reject();
    }
    if (panel.libraryPanel && panel.libraryPanel.uid === undefined) {
        return addLibraryPanel(panel, folderId);
    }
    return updateLibraryPanel(panel);
}
//# sourceMappingURL=utils.js.map