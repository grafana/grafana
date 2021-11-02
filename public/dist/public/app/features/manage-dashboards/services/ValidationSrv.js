import { __awaiter, __generator, __values } from "tslib";
import coreModule from 'app/core/core_module';
import { backendSrv } from 'app/core/services/backend_srv';
var hitTypes = {
    FOLDER: 'dash-folder',
    DASHBOARD: 'dash-db',
};
var ValidationSrv = /** @class */ (function () {
    function ValidationSrv() {
        this.rootName = 'general';
    }
    ValidationSrv.prototype.validateNewDashboardName = function (folderId, name) {
        return this.validate(folderId, name, 'A dashboard or a folder with the same name already exists');
    };
    ValidationSrv.prototype.validateNewFolderName = function (name) {
        return this.validate(0, name, 'A folder or dashboard in the general folder with the same name already exists');
    };
    ValidationSrv.prototype.validate = function (folderId, name, existingErrorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var nameLowerCased, promises, res, hits, hits_1, hits_1_1, hit;
            var e_1, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        name = (name || '').trim();
                        nameLowerCased = name.toLowerCase();
                        if (name.length === 0) {
                            throw {
                                type: 'REQUIRED',
                                message: 'Name is required',
                            };
                        }
                        if (folderId === 0 && nameLowerCased === this.rootName) {
                            throw {
                                type: 'EXISTING',
                                message: 'This is a reserved name and cannot be used for a folder.',
                            };
                        }
                        promises = [];
                        promises.push(backendSrv.search({ type: hitTypes.FOLDER, folderIds: [folderId], query: name }));
                        promises.push(backendSrv.search({ type: hitTypes.DASHBOARD, folderIds: [folderId], query: name }));
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        res = _b.sent();
                        hits = [];
                        if (res.length > 0 && res[0].length > 0) {
                            hits = res[0];
                        }
                        if (res.length > 1 && res[1].length > 0) {
                            hits = hits.concat(res[1]);
                        }
                        try {
                            for (hits_1 = __values(hits), hits_1_1 = hits_1.next(); !hits_1_1.done; hits_1_1 = hits_1.next()) {
                                hit = hits_1_1.value;
                                if (nameLowerCased === hit.title.toLowerCase()) {
                                    throw {
                                        type: 'EXISTING',
                                        message: existingErrorMessage,
                                    };
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (hits_1_1 && !hits_1_1.done && (_a = hits_1.return)) _a.call(hits_1);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return ValidationSrv;
}());
export { ValidationSrv };
var validationSrv = new ValidationSrv();
export default validationSrv;
coreModule.service('validationSrv', ValidationSrv);
//# sourceMappingURL=ValidationSrv.js.map