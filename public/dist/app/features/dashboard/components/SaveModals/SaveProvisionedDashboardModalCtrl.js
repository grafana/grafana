import angular from 'angular';
import { saveAs } from 'file-saver';
import coreModule from 'app/core/core_module';
var template = "\n<div class=\"modal-body\">\n  <div class=\"modal-header\">\n    <h2 class=\"modal-header-title\">\n      <i class=\"fa fa-save\"></i><span class=\"p-l-1\">Cannot save provisioned dashboard</span>\n    </h2>\n\n    <a class=\"modal-header-close\" ng-click=\"ctrl.dismiss();\">\n      <i class=\"fa fa-remove\"></i>\n    </a>\n  </div>\n\n  <div class=\"modal-content\">\n    <small>\n      This dashboard cannot be saved from Grafana's UI since it has been provisioned from another source.\n      Copy the JSON or save it to a file below. Then you can update your dashboard in corresponding provisioning source.<br/>\n      <i>See <a class=\"external-link\" href=\"http://docs.grafana.org/administration/provisioning/#dashboards\" target=\"_blank\">\n      documentation</a> for more information about provisioning.</i>\n    </small>\n    <div class=\"p-t-2\">\n      <div class=\"gf-form\">\n        <code-editor content=\"ctrl.dashboardJson\" data-mode=\"json\" data-max-lines=15></code-editor>\n      </div>\n      <div class=\"gf-form-button-row\">\n        <button class=\"btn btn-primary\" clipboard-button=\"ctrl.getJsonForClipboard()\">\n          <i class=\"fa fa-clipboard\"></i>&nbsp;Copy JSON to Clipboard\n        </button>\n        <button class=\"btn btn-secondary\" clipboard-button=\"ctrl.save()\">\n          <i class=\"fa fa-save\"></i>&nbsp;Save JSON to file\n        </button>\n        <a class=\"btn btn-link\" ng-click=\"ctrl.dismiss();\">Cancel</a>\n      </div>\n    </div>\n  </div>\n</div>\n";
var SaveProvisionedDashboardModalCtrl = /** @class */ (function () {
    /** @ngInject */
    function SaveProvisionedDashboardModalCtrl(dashboardSrv) {
        this.dash = dashboardSrv.getCurrent().getSaveModelClone();
        delete this.dash.id;
        this.dashboardJson = angular.toJson(this.dash, true);
    }
    SaveProvisionedDashboardModalCtrl.prototype.save = function () {
        var blob = new Blob([angular.toJson(this.dash, true)], {
            type: 'application/json;charset=utf-8',
        });
        saveAs(blob, this.dash.title + '-' + new Date().getTime() + '.json');
    };
    SaveProvisionedDashboardModalCtrl.prototype.getJsonForClipboard = function () {
        return this.dashboardJson;
    };
    return SaveProvisionedDashboardModalCtrl;
}());
export { SaveProvisionedDashboardModalCtrl };
export function saveProvisionedDashboardModalDirective() {
    return {
        restrict: 'E',
        template: template,
        controller: SaveProvisionedDashboardModalCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('saveProvisionedDashboardModal', saveProvisionedDashboardModalDirective);
//# sourceMappingURL=SaveProvisionedDashboardModalCtrl.js.map