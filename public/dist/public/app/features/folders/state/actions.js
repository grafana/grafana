import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { locationUtil } from '@grafana/data';
import { getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { notifyApp, updateNavIndex } from 'app/core/actions';
import { createSuccessNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { buildNavModel } from './navModel';
import { loadFolder, loadFolderPermissions, setCanViewFolderPermissions } from './reducers';
export function getFolderByUid(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const folder = yield backendSrv.getFolderByUid(uid);
        dispatch(loadFolder(folder));
        dispatch(updateNavIndex(buildNavModel(folder)));
        return folder;
    });
}
export function saveFolder(folder) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const res = yield backendSrv.put(`/api/folders/${folder.uid}`, {
            title: folder.title,
            version: folder.version,
        });
        dispatch(notifyApp(createSuccessNotification('Folder saved')));
        dispatch(loadFolder(res));
        locationService.push(locationUtil.stripBaseFromUrl(`${res.url}/settings`));
    });
}
export function deleteFolder(uid) {
    return () => __awaiter(this, void 0, void 0, function* () {
        yield backendSrv.delete(`/api/folders/${uid}?forceDeleteRules=false`);
        locationService.push('/dashboards');
    });
}
export function getFolderPermissions(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const permissions = yield backendSrv.get(`/api/folders/${uid}/permissions`);
        dispatch(loadFolderPermissions(permissions));
    });
}
export function checkFolderPermissions(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            yield lastValueFrom(backendSrv.fetch({
                method: 'GET',
                showErrorAlert: false,
                showSuccessAlert: false,
                url: `/api/folders/${uid}/permissions`,
            }));
            dispatch(setCanViewFolderPermissions(true));
        }
        catch (err) {
            if (isFetchError(err) && err.status !== 403) {
                dispatch(notifyApp(createWarningNotification('Error checking folder permissions', (_a = err.data) === null || _a === void 0 ? void 0 : _a.message)));
            }
            dispatch(setCanViewFolderPermissions(false));
        }
    });
}
function toUpdateItem(item) {
    return {
        userId: item.userId,
        teamId: item.teamId,
        role: item.role,
        permission: item.permission,
    };
}
export function updateFolderPermission(itemToUpdate, level) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const folder = getStore().folder;
        const itemsToUpdate = [];
        for (const item of folder.permissions) {
            if (item.inherited) {
                continue;
            }
            const updated = toUpdateItem(item);
            // if this is the item we want to update, update its permission
            if (itemToUpdate === item) {
                updated.permission = level;
            }
            itemsToUpdate.push(updated);
        }
        yield backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
        yield dispatch(getFolderPermissions(folder.uid));
    });
}
export function removeFolderPermission(itemToDelete) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const folder = getStore().folder;
        const itemsToUpdate = [];
        for (const item of folder.permissions) {
            if (item.inherited || item === itemToDelete) {
                continue;
            }
            itemsToUpdate.push(toUpdateItem(item));
        }
        yield backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
        yield dispatch(getFolderPermissions(folder.uid));
    });
}
export function addFolderPermission(newItem) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const folder = getStore().folder;
        const itemsToUpdate = [];
        for (const item of folder.permissions) {
            if (item.inherited) {
                continue;
            }
            itemsToUpdate.push(toUpdateItem(item));
        }
        itemsToUpdate.push({
            userId: newItem.userId,
            teamId: newItem.teamId,
            role: newItem.role,
            permission: newItem.permission,
        });
        yield backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
        yield dispatch(getFolderPermissions(folder.uid));
    });
}
export function createNewFolder(folderName, uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const newFolder = yield getBackendSrv().post('/api/folders', { title: folderName, parentUid: uid });
        yield contextSrv.fetchUserPermissions();
        dispatch(notifyApp(createSuccessNotification('Folder Created', 'OK')));
        locationService.push(locationUtil.stripBaseFromUrl(newFolder.url));
    });
}
//# sourceMappingURL=actions.js.map