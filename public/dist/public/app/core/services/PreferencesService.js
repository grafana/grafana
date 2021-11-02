import { backendSrv } from './backend_srv';
var PreferencesService = /** @class */ (function () {
    function PreferencesService(resourceUri) {
        this.resourceUri = resourceUri;
    }
    PreferencesService.prototype.update = function (preferences) {
        return backendSrv.put("/api/" + this.resourceUri + "/preferences", preferences);
    };
    PreferencesService.prototype.load = function () {
        return backendSrv.get("/api/" + this.resourceUri + "/preferences");
    };
    return PreferencesService;
}());
export { PreferencesService };
//# sourceMappingURL=PreferencesService.js.map