import { __awaiter } from "tslib";
import { dataFrameFromJSON, getDisplayProcessor } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
class SimpleStorage {
    constructor() { }
    get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const storagePath = `api/storage/read/${path}`.replace('//', '/');
            return getBackendSrv().get(storagePath);
        });
    }
    list(path) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = 'api/storage/list/';
            if (path) {
                url += path + '/';
            }
            const rsp = yield getBackendSrv().get(url);
            if (rsp === null || rsp === void 0 ? void 0 : rsp.data) {
                const f = dataFrameFromJSON(rsp);
                for (const field of f.fields) {
                    field.display = getDisplayProcessor({ field, theme: config.theme2 });
                }
                return f;
            }
            return undefined;
        });
    }
    createFolder(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield getBackendSrv().post('/api/storage/createFolder', JSON.stringify({ path }));
            if (!res.success) {
                return {
                    error: (_a = res.message) !== null && _a !== void 0 ? _a : 'unknown error',
                };
            }
            return {};
        });
    }
    deleteFolder(req) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield getBackendSrv().post(`/api/storage/deleteFolder`, JSON.stringify(req));
            if (!res.success) {
                return {
                    error: (_a = res.message) !== null && _a !== void 0 ? _a : 'unknown error',
                };
            }
            return {};
        });
    }
    deleteFile(req) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield getBackendSrv().post(`/api/storage/delete/${req.path}`);
            if (!res.success) {
                return {
                    error: (_a = res.message) !== null && _a !== void 0 ? _a : 'unknown error',
                };
            }
            return {};
        });
    }
    delete(req) {
        return __awaiter(this, void 0, void 0, function* () {
            return req.isFolder ? this.deleteFolder({ path: req.path, force: true }) : this.deleteFile({ path: req.path });
        });
    }
    upload(folder, file, overwriteExistingFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const formData = new FormData();
            formData.append('folder', folder);
            formData.append('file', file);
            formData.append('overwriteExistingFile', String(overwriteExistingFile));
            const res = yield fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
            });
            let body = yield res.json();
            if (!body) {
                body = {};
            }
            body.status = res.status;
            body.statusText = res.statusText;
            if (res.status !== 200 && !body.err) {
                body.err = true;
            }
            return body;
        });
    }
    write(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return backendSrv.post(`/api/storage/write/${path}`, options);
        });
    }
    getConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            return getBackendSrv().get('/api/storage/config');
        });
    }
    getOptions(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return getBackendSrv().get(`/api/storage/options/${path}`);
        });
    }
}
export function filenameAlreadyExists(folderName, fileNames) {
    const lowerCase = folderName.toLowerCase();
    const trimmedLowerCase = lowerCase.trim();
    const existingTrimmedLowerCaseNames = fileNames.map((f) => f.trim().toLowerCase());
    return existingTrimmedLowerCaseNames.includes(trimmedLowerCase);
}
let storage;
export function getGrafanaStorage() {
    if (!storage) {
        storage = new SimpleStorage();
    }
    return storage;
}
//# sourceMappingURL=storage.js.map