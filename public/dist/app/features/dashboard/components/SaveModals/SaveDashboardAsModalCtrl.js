import coreModule from 'app/core/core_module';
var template = "\n<div class=\"modal-body\">\n\t<div class=\"modal-header\">\n\t\t<h2 class=\"modal-header-title\">\n\t\t\t<i class=\"fa fa-copy\"></i>\n\t\t\t<span class=\"p-l-1\">Save As...</span>\n\t\t</h2>\n\n\t\t<a class=\"modal-header-close\" ng-click=\"ctrl.dismiss();\">\n\t\t\t<i class=\"fa fa-remove\"></i>\n\t\t</a>\n\t</div>\n\n\t<form name=\"ctrl.saveForm\" class=\"modal-content\" novalidate>\n\t\t<div class=\"p-t-2\">\n\t\t\t<div class=\"gf-form\">\n\t\t\t\t<label class=\"gf-form-label width-8\">New name</label>\n\t\t\t\t<input type=\"text\" class=\"gf-form-input\" ng-model=\"ctrl.clone.title\" give-focus=\"true\" required>\n\t\t\t</div>\n      <folder-picker initial-folder-id=\"ctrl.folderId\"\n                       on-change=\"ctrl.onFolderChange($folder)\"\n                       enter-folder-creation=\"ctrl.onEnterFolderCreation()\"\n                       exit-folder-creation=\"ctrl.onExitFolderCreation()\"\n                       enable-create-new=\"true\"\n                       label-class=\"width-8\"\n                       dashboard-id=\"ctrl.clone.id\">\n      </folder-picker>\n      <div class=\"gf-form-inline\">\n        <gf-form-switch class=\"gf-form\" label=\"Copy tags\" label-class=\"width-8\" checked=\"ctrl.copyTags\">\n        </gf-form-switch>\n      </div>\n\t\t</div>\n\n\t\t<div class=\"gf-form-button-row text-center\">\n\t\t\t<button type=\"submit\" class=\"btn btn-primary\" ng-click=\"ctrl.save()\" ng-disabled=\"!ctrl.isValidFolderSelection\">Save</button>\n\t\t\t<a class=\"btn-text\" ng-click=\"ctrl.dismiss();\">Cancel</a>\n\t\t</div>\n\t</form>\n</div>\n";
var SaveDashboardAsModalCtrl = /** @class */ (function () {
    /** @ngInject */
    function SaveDashboardAsModalCtrl(dashboardSrv) {
        this.dashboardSrv = dashboardSrv;
        this.isValidFolderSelection = true;
        var dashboard = this.dashboardSrv.getCurrent();
        this.clone = dashboard.getSaveModelClone();
        this.clone.id = null;
        this.clone.uid = '';
        this.clone.title += ' Copy';
        this.clone.editable = true;
        this.clone.hideControls = false;
        this.folderId = dashboard.meta.folderId;
        this.copyTags = false;
        // remove alerts if source dashboard is already persisted
        // do not want to create alert dupes
        if (dashboard.id > 0) {
            this.clone.panels.forEach(function (panel) {
                if (panel.type === 'graph' && panel.alert) {
                    delete panel.thresholds;
                }
                delete panel.alert;
            });
        }
        delete this.clone.autoUpdate;
    }
    SaveDashboardAsModalCtrl.prototype.save = function () {
        if (!this.copyTags) {
            this.clone.tags = [];
        }
        return this.dashboardSrv.save(this.clone, { folderId: this.folderId }).then(this.dismiss);
    };
    SaveDashboardAsModalCtrl.prototype.keyDown = function (evt) {
        if (evt.keyCode === 13) {
            this.save();
        }
    };
    SaveDashboardAsModalCtrl.prototype.onFolderChange = function (folder) {
        this.folderId = folder.id;
    };
    SaveDashboardAsModalCtrl.prototype.onEnterFolderCreation = function () {
        this.isValidFolderSelection = false;
    };
    SaveDashboardAsModalCtrl.prototype.onExitFolderCreation = function () {
        this.isValidFolderSelection = true;
    };
    return SaveDashboardAsModalCtrl;
}());
export { SaveDashboardAsModalCtrl };
export function saveDashboardAsDirective() {
    return {
        restrict: 'E',
        template: template,
        controller: SaveDashboardAsModalCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('saveDashboardAsModal', saveDashboardAsDirective);
//# sourceMappingURL=SaveDashboardAsModalCtrl.js.map