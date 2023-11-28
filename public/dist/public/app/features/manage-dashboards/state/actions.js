import { __awaiter } from "tslib";
import { locationUtil } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, isFetchError, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { SearchQueryType } from 'app/types';
import { getLibraryPanel } from '../../library-panels/state/api';
import { LibraryElementKind } from '../../library-panels/types';
import { clearDashboard, fetchDashboard, fetchFailed, InputType, LibraryPanelInputState, setGcomDashboard, setInputs, setJsonDashboard, setLibraryPanelInputs, } from './reducers';
export function fetchGcomDashboard(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            dispatch(fetchDashboard());
            const dashboard = yield getBackendSrv().get(`/api/gnet/dashboards/${id}`);
            yield dispatch(processElements(dashboard.json));
            yield dispatch(processGcomDashboard(dashboard));
            dispatch(processInputs());
        }
        catch (error) {
            dispatch(fetchFailed());
            if (isFetchError(error)) {
                dispatch(notifyApp(createErrorNotification(error.data.message || error)));
            }
        }
    });
}
export function importDashboardJson(dashboard) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(processElements(dashboard));
        yield dispatch(processJsonDashboard(dashboard));
        dispatch(processInputs());
    });
}
const getNewLibraryPanelsByInput = (input, state) => {
    var _a, _b;
    return (_b = (_a = input === null || input === void 0 ? void 0 : input.usage) === null || _a === void 0 ? void 0 : _a.libraryPanels) === null || _b === void 0 ? void 0 : _b.filter((usageLibPanel) => state.inputs.libraryPanels.some((libPanel) => libPanel.state !== LibraryPanelInputState.Exists && libPanel.model.uid === usageLibPanel.uid));
};
export function processDashboard(dashboardJson, state) {
    var _a, _b;
    let inputs = dashboardJson.__inputs;
    if (!!((_a = state.inputs.libraryPanels) === null || _a === void 0 ? void 0 : _a.length)) {
        const filteredUsedInputs = [];
        (_b = dashboardJson.__inputs) === null || _b === void 0 ? void 0 : _b.forEach((input) => {
            var _a;
            if (!((_a = input === null || input === void 0 ? void 0 : input.usage) === null || _a === void 0 ? void 0 : _a.libraryPanels)) {
                filteredUsedInputs.push(input);
                return;
            }
            const newLibraryPanels = getNewLibraryPanelsByInput(input, state);
            input.usage = { libraryPanels: newLibraryPanels };
            const isInputBeingUsedByANewLibraryPanel = !!(newLibraryPanels === null || newLibraryPanels === void 0 ? void 0 : newLibraryPanels.length);
            if (isInputBeingUsedByANewLibraryPanel) {
                filteredUsedInputs.push(input);
            }
        });
        inputs = filteredUsedInputs;
    }
    return Object.assign(Object.assign({}, dashboardJson), { __inputs: inputs });
}
function processGcomDashboard(dashboard) {
    return (dispatch, getState) => {
        const state = getState().importDashboard;
        const dashboardJson = processDashboard(dashboard.json, state);
        dispatch(setGcomDashboard(Object.assign(Object.assign({}, dashboard), { json: dashboardJson })));
    };
}
function processJsonDashboard(dashboardJson) {
    return (dispatch, getState) => {
        const state = getState().importDashboard;
        const dashboard = processDashboard(dashboardJson, state);
        dispatch(setJsonDashboard(dashboard));
    };
}
function processInputs() {
    return (dispatch, getState) => {
        const dashboard = getState().importDashboard.dashboard;
        if (dashboard && dashboard.__inputs) {
            const inputs = [];
            dashboard.__inputs.forEach((input) => {
                const inputModel = {
                    name: input.name,
                    label: input.label,
                    info: input.description,
                    value: input.value,
                    type: input.type,
                    pluginId: input.pluginId,
                    options: [],
                };
                inputModel.description = getDataSourceDescription(input);
                if (input.type === InputType.DataSource) {
                    getDataSourceOptions(input, inputModel);
                }
                else if (!inputModel.info) {
                    inputModel.info = 'Specify a string constant';
                }
                inputs.push(inputModel);
            });
            dispatch(setInputs(inputs));
        }
    };
}
function processElements(dashboardJson) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            const libraryPanelInputs = yield getLibraryPanelInputs(dashboardJson);
            dispatch(setLibraryPanelInputs(libraryPanelInputs));
        });
    };
}
export function getLibraryPanelInputs(dashboardJson) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!dashboardJson || !dashboardJson.__elements) {
            return [];
        }
        const libraryPanelInputs = [];
        for (const element of Object.values(dashboardJson.__elements)) {
            if (element.kind !== LibraryElementKind.Panel) {
                continue;
            }
            const model = element.model;
            const { type, description } = model;
            const { uid, name } = element;
            const input = {
                model: {
                    model,
                    uid,
                    name,
                    version: 0,
                    type,
                    kind: LibraryElementKind.Panel,
                    description,
                },
                state: LibraryPanelInputState.New,
            };
            try {
                const panelInDb = yield getLibraryPanel(uid, true);
                input.state = LibraryPanelInputState.Exists;
                input.model = panelInDb;
            }
            catch (e) {
                if (e.status !== 404) {
                    throw e;
                }
            }
            libraryPanelInputs.push(input);
        }
        return libraryPanelInputs;
    });
}
export function clearLoadedDashboard() {
    return (dispatch) => {
        dispatch(clearDashboard());
    };
}
export function importDashboard(importDashboardForm) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const dashboard = getState().importDashboard.dashboard;
        const inputs = getState().importDashboard.inputs;
        let inputsToPersist = [];
        (_a = importDashboardForm.dataSources) === null || _a === void 0 ? void 0 : _a.forEach((dataSource, index) => {
            const input = inputs.dataSources[index];
            inputsToPersist.push({
                name: input.name,
                type: input.type,
                pluginId: input.pluginId,
                value: dataSource.uid,
            });
        });
        (_b = importDashboardForm.constants) === null || _b === void 0 ? void 0 : _b.forEach((constant, index) => {
            const input = inputs.constants[index];
            inputsToPersist.push({
                value: constant,
                name: input.name,
                type: input.type,
            });
        });
        const result = yield getBackendSrv().post('api/dashboards/import', {
            // uid: if user changed it, take the new uid from importDashboardForm,
            // else read it from original dashboard
            // by default the uid input is disabled, onSubmit ignores values from disabled inputs
            dashboard: Object.assign(Object.assign({}, dashboard), { title: importDashboardForm.title, uid: importDashboardForm.uid || dashboard.uid }),
            overwrite: true,
            inputs: inputsToPersist,
            folderUid: importDashboardForm.folder.uid,
        });
        const dashboardUrl = locationUtil.stripBaseFromUrl(result.importedUrl);
        locationService.push(dashboardUrl);
    });
}
const getDataSourceOptions = (input, inputModel) => {
    const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });
    if (sources.length === 0) {
        inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
    }
    else if (!inputModel.info) {
        inputModel.info = 'Select a ' + input.pluginName + ' data source';
    }
};
const getDataSourceDescription = (input) => {
    if (!input.usage) {
        return undefined;
    }
    if (input.usage.libraryPanels) {
        const libPanelNames = input.usage.libraryPanels.reduce((acc, libPanel, index) => (index === 0 ? libPanel.name : `${acc}, ${libPanel.name}`), '');
        return `List of affected library panels: ${libPanelNames}`;
    }
    return undefined;
};
export function moveFolders(folderUIDs, toFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = {
            totalCount: folderUIDs.length,
            successCount: 0,
        };
        for (const folderUID of folderUIDs) {
            try {
                const newFolderDTO = yield moveFolder(folderUID, toFolder);
                if (newFolderDTO !== null) {
                    result.successCount += 1;
                }
            }
            catch (err) {
                console.error('Failed to move a folder', err);
            }
        }
        return result;
    });
}
export function moveDashboards(dashboardUids, toFolder) {
    const tasks = [];
    for (const uid of dashboardUids) {
        tasks.push(createTask(moveDashboard, true, uid, toFolder));
    }
    return executeInOrder(tasks).then((result) => {
        return {
            totalCount: result.length,
            successCount: result.filter((res) => res.succeeded).length,
            alreadyInFolderCount: result.filter((res) => res.alreadyInFolder).length,
        };
    });
}
function moveDashboard(uid, toFolder) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const fullDash = yield getBackendSrv().get(`/api/dashboards/uid/${uid}`);
        if (((fullDash.meta.folderUid === undefined || fullDash.meta.folderUid === null) && toFolder.uid === '') ||
            fullDash.meta.folderUid === toFolder.uid) {
            return { alreadyInFolder: true };
        }
        const options = {
            dashboard: fullDash.dashboard,
            folderUid: toFolder.uid,
            overwrite: false,
        };
        try {
            yield saveDashboard(options);
            return { succeeded: true };
        }
        catch (err) {
            if (isFetchError(err)) {
                if (((_a = err.data) === null || _a === void 0 ? void 0 : _a.status) !== 'plugin-dashboard') {
                    return { succeeded: false };
                }
                err.isHandled = true;
            }
            options.overwrite = true;
            try {
                yield saveDashboard(options);
                return { succeeded: true };
            }
            catch (e) {
                return { succeeded: false };
            }
        }
    });
}
function createTask(fn, ignoreRejections, ...args) {
    return (result) => __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield fn(...args);
            return Array.prototype.concat(result, [res]);
        }
        catch (err) {
            if (ignoreRejections) {
                return result;
            }
            throw err;
        }
    });
}
export function deleteFoldersAndDashboards(folderUids, dashboardUids) {
    const tasks = [];
    for (const folderUid of folderUids) {
        tasks.push(createTask(deleteFolder, true, folderUid, true));
    }
    for (const dashboardUid of dashboardUids) {
        tasks.push(createTask(deleteDashboard, true, dashboardUid, true));
    }
    return executeInOrder(tasks);
}
export function saveDashboard(options) {
    var _a, _b;
    dashboardWatcher.ignoreNextSave();
    return getBackendSrv().post('/api/dashboards/db/', {
        dashboard: options.dashboard,
        message: (_a = options.message) !== null && _a !== void 0 ? _a : '',
        overwrite: (_b = options.overwrite) !== null && _b !== void 0 ? _b : false,
        folderUid: options.folderUid,
    });
}
function deleteFolder(uid, showSuccessAlert) {
    return getBackendSrv().delete(`/api/folders/${uid}?forceDeleteRules=false`, undefined, { showSuccessAlert });
}
export function createFolder(payload) {
    return getBackendSrv().post('/api/folders', payload);
}
export function moveFolder(uid, toFolder) {
    const payload = {
        parentUid: toFolder.uid,
    };
    return getBackendSrv().post(`/api/folders/${uid}/move`, payload, { showErrorAlert: false });
}
export const SLICE_FOLDER_RESULTS_TO = 1000;
export function searchFolders(query, permission, type = SearchQueryType.Folder) {
    return getBackendSrv().get('/api/search', {
        query,
        type: type,
        permission,
        limit: SLICE_FOLDER_RESULTS_TO,
    });
}
export function getFolderByUid(uid) {
    return getBackendSrv().get(`/api/folders/${uid}`);
}
export function getFolderById(id) {
    return getBackendSrv().get(`/api/folders/id/${id}`);
}
export function deleteDashboard(uid, showSuccessAlert) {
    return getBackendSrv().delete(`/api/dashboards/uid/${uid}`, { showSuccessAlert });
}
function executeInOrder(tasks) {
    return tasks.reduce((acc, task) => {
        return Promise.resolve(acc).then(task);
    }, []);
}
// @PERCONA
export function fetchFolders() {
    return getBackendSrv().get('/api/folders');
}
//# sourceMappingURL=actions.js.map