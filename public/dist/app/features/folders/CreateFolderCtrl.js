import appEvents from 'app/core/app_events';
import locationUtil from 'app/core/utils/location_util';
var CreateFolderCtrl = /** @class */ (function () {
    /** @ngInject */
    function CreateFolderCtrl(backendSrv, $location, validationSrv, navModelSrv) {
        this.backendSrv = backendSrv;
        this.$location = $location;
        this.validationSrv = validationSrv;
        this.title = '';
        this.titleTouched = false;
        this.navModel = navModelSrv.getNav('dashboards', 'manage-dashboards', 0);
    }
    CreateFolderCtrl.prototype.create = function () {
        var _this = this;
        if (this.hasValidationError) {
            return;
        }
        return this.backendSrv.createFolder({ title: this.title }).then(function (result) {
            appEvents.emit('alert-success', ['Folder Created', 'OK']);
            _this.$location.url(locationUtil.stripBaseFromUrl(result.url));
        });
    };
    CreateFolderCtrl.prototype.titleChanged = function () {
        var _this = this;
        this.titleTouched = true;
        this.validationSrv
            .validateNewFolderName(this.title)
            .then(function () {
            _this.hasValidationError = false;
        })
            .catch(function (err) {
            _this.hasValidationError = true;
            _this.validationError = err.message;
        });
    };
    return CreateFolderCtrl;
}());
export default CreateFolderCtrl;
//# sourceMappingURL=CreateFolderCtrl.js.map