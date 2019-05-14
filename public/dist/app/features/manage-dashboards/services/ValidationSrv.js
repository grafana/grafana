import * as tslib_1 from "tslib";
import coreModule from 'app/core/core_module';
var hitTypes = {
    FOLDER: 'dash-folder',
    DASHBOARD: 'dash-db',
};
var ValidationSrv = /** @class */ (function () {
    /** @ngInject */
    function ValidationSrv($q, backendSrv) {
        this.$q = $q;
        this.backendSrv = backendSrv;
        this.rootName = 'general';
    }
    ValidationSrv.prototype.validateNewDashboardName = function (folderId, name) {
        return this.validate(folderId, name, 'A dashboard in this folder with the same name already exists');
    };
    ValidationSrv.prototype.validateNewFolderName = function (name) {
        return this.validate(0, name, 'A folder or dashboard in the general folder with the same name already exists');
    };
    ValidationSrv.prototype.validate = function (folderId, name, existingErrorMessage) {
        name = (name || '').trim();
        var nameLowerCased = name.toLowerCase();
        if (name.length === 0) {
            return this.$q.reject({
                type: 'REQUIRED',
                message: 'Name is required',
            });
        }
        if (folderId === 0 && nameLowerCased === this.rootName) {
            return this.$q.reject({
                type: 'EXISTING',
                message: 'This is a reserved name and cannot be used for a folder.',
            });
        }
        var deferred = this.$q.defer();
        var promises = [];
        promises.push(this.backendSrv.search({ type: hitTypes.FOLDER, folderIds: [folderId], query: name }));
        promises.push(this.backendSrv.search({ type: hitTypes.DASHBOARD, folderIds: [folderId], query: name }));
        this.$q.all(promises).then(function (res) {
            var e_1, _a;
            var hits = [];
            if (res.length > 0 && res[0].length > 0) {
                hits = res[0];
            }
            if (res.length > 1 && res[1].length > 0) {
                hits = hits.concat(res[1]);
            }
            try {
                for (var hits_1 = tslib_1.__values(hits), hits_1_1 = hits_1.next(); !hits_1_1.done; hits_1_1 = hits_1.next()) {
                    var hit = hits_1_1.value;
                    if (nameLowerCased === hit.title.toLowerCase()) {
                        deferred.reject({
                            type: 'EXISTING',
                            message: existingErrorMessage,
                        });
                        break;
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
            deferred.resolve();
        });
        return deferred.promise;
    };
    return ValidationSrv;
}());
export { ValidationSrv };
coreModule.service('validationSrv', ValidationSrv);
//# sourceMappingURL=ValidationSrv.js.map