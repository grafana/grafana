import * as tslib_1 from "tslib";
import _ from 'lodash';
import config from 'app/core/config';
import locationUtil from 'app/core/utils/location_util';
var DashboardImportCtrl = /** @class */ (function () {
    /** @ngInject */
    function DashboardImportCtrl(backendSrv, validationSrv, navModelSrv, $location, $routeParams) {
        this.backendSrv = backendSrv;
        this.validationSrv = validationSrv;
        this.$location = $location;
        this.navModel = navModelSrv.getNav('create', 'import');
        this.step = 1;
        this.nameExists = false;
        this.uidExists = false;
        this.autoGenerateUid = true;
        this.autoGenerateUidValue = 'auto-generated';
        this.folderId = $routeParams.folderId ? Number($routeParams.folderId) || 0 : null;
        this.initialFolderTitle = 'Select a folder';
        // check gnetId in url
        if ($routeParams.gnetId) {
            this.gnetUrl = $routeParams.gnetId;
            this.checkGnetDashboard();
        }
    }
    DashboardImportCtrl.prototype.onUpload = function (dash) {
        var e_1, _a;
        this.dash = dash;
        this.dash.id = null;
        this.step = 2;
        this.inputs = [];
        if (this.dash.__inputs) {
            try {
                for (var _b = tslib_1.__values(this.dash.__inputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var input = _c.value;
                    var inputModel = {
                        name: input.name,
                        label: input.label,
                        info: input.description,
                        value: input.value,
                        type: input.type,
                        pluginId: input.pluginId,
                        options: [],
                    };
                    if (input.type === 'datasource') {
                        this.setDatasourceOptions(input, inputModel);
                    }
                    else if (!inputModel.info) {
                        inputModel.info = 'Specify a string constant';
                    }
                    this.inputs.push(inputModel);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        this.inputsValid = this.inputs.length === 0;
        this.titleChanged();
        this.uidChanged(true);
    };
    DashboardImportCtrl.prototype.setDatasourceOptions = function (input, inputModel) {
        var sources = _.filter(config.datasources, function (val) {
            return val.type === input.pluginId;
        });
        if (sources.length === 0) {
            inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
        }
        else if (!inputModel.info) {
            inputModel.info = 'Select a ' + input.pluginName + ' data source';
        }
        inputModel.options = sources.map(function (val) {
            return { text: val.name, value: val.name };
        });
    };
    DashboardImportCtrl.prototype.inputValueChanged = function () {
        var e_2, _a;
        this.inputsValid = true;
        try {
            for (var _b = tslib_1.__values(this.inputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                var input = _c.value;
                if (!input.value) {
                    this.inputsValid = false;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    DashboardImportCtrl.prototype.titleChanged = function () {
        var _this = this;
        this.titleTouched = true;
        this.nameExists = false;
        this.validationSrv
            .validateNewDashboardName(this.folderId, this.dash.title)
            .then(function () {
            _this.nameExists = false;
            _this.hasNameValidationError = false;
        })
            .catch(function (err) {
            if (err.type === 'EXISTING') {
                _this.nameExists = true;
            }
            _this.hasNameValidationError = true;
            _this.nameValidationError = err.message;
        });
    };
    DashboardImportCtrl.prototype.uidChanged = function (initial) {
        var _this = this;
        this.uidExists = false;
        this.hasUidValidationError = false;
        if (initial === true && this.dash.uid) {
            this.autoGenerateUidValue = 'value set';
        }
        this.backendSrv
            .getDashboardByUid(this.dash.uid)
            .then(function (res) {
            _this.uidExists = true;
            _this.hasUidValidationError = true;
            _this.uidValidationError = "Dashboard named '" + res.dashboard.title + "' in folder '" + res.meta.folderTitle + "' has the same uid";
        })
            .catch(function (err) {
            err.isHandled = true;
        });
    };
    DashboardImportCtrl.prototype.onFolderChange = function (folder) {
        this.folderId = folder.id;
        this.titleChanged();
    };
    DashboardImportCtrl.prototype.onEnterFolderCreation = function () {
        this.inputsValid = false;
    };
    DashboardImportCtrl.prototype.onExitFolderCreation = function () {
        this.inputValueChanged();
    };
    DashboardImportCtrl.prototype.isValid = function () {
        return this.inputsValid && this.folderId !== null;
    };
    DashboardImportCtrl.prototype.saveDashboard = function () {
        var _this = this;
        var inputs = this.inputs.map(function (input) {
            return {
                name: input.name,
                type: input.type,
                pluginId: input.pluginId,
                value: input.value,
            };
        });
        return this.backendSrv
            .post('api/dashboards/import', {
            dashboard: this.dash,
            overwrite: true,
            inputs: inputs,
            folderId: this.folderId,
        })
            .then(function (res) {
            var dashUrl = locationUtil.stripBaseFromUrl(res.importedUrl);
            _this.$location.url(dashUrl);
        });
    };
    DashboardImportCtrl.prototype.loadJsonText = function () {
        try {
            this.parseError = '';
            var dash = JSON.parse(this.jsonText);
            this.onUpload(dash);
        }
        catch (err) {
            console.log(err);
            this.parseError = err.message;
            return;
        }
    };
    DashboardImportCtrl.prototype.checkGnetDashboard = function () {
        var _this = this;
        this.gnetError = '';
        var match = /(^\d+$)|dashboards\/(\d+)/.exec(this.gnetUrl);
        var dashboardId;
        if (match && match[1]) {
            dashboardId = match[1];
        }
        else if (match && match[2]) {
            dashboardId = match[2];
        }
        else {
            this.gnetError = 'Could not find dashboard';
        }
        return this.backendSrv
            .get('api/gnet/dashboards/' + dashboardId)
            .then(function (res) {
            _this.gnetInfo = res;
            // store reference to grafana.com
            res.json.gnetId = res.id;
            _this.onUpload(res.json);
        })
            .catch(function (err) {
            err.isHandled = true;
            _this.gnetError = err.data.message || err;
        });
    };
    DashboardImportCtrl.prototype.back = function () {
        this.gnetUrl = '';
        this.step = 1;
        this.gnetError = '';
        this.gnetInfo = '';
    };
    return DashboardImportCtrl;
}());
export { DashboardImportCtrl };
export default DashboardImportCtrl;
//# sourceMappingURL=DashboardImportCtrl.js.map