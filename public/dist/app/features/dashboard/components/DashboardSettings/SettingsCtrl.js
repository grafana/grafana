import * as tslib_1 from "tslib";
import { coreModule, appEvents, contextSrv } from 'app/core/core';
import $ from 'jquery';
import _ from 'lodash';
import angular from 'angular';
import config from 'app/core/config';
var SettingsCtrl = /** @class */ (function () {
    /** @ngInject */
    function SettingsCtrl($scope, $route, $location, $rootScope, backendSrv, dashboardSrv) {
        var _this = this;
        this.$scope = $scope;
        this.$route = $route;
        this.$location = $location;
        this.$rootScope = $rootScope;
        this.backendSrv = backendSrv;
        this.dashboardSrv = dashboardSrv;
        // temp hack for annotations and variables editors
        // that rely on inherited scope
        $scope.dashboard = this.dashboard;
        this.$scope.$on('$destroy', function () {
            _this.dashboard.updateSubmenuVisibility();
            setTimeout(function () {
                _this.$rootScope.appEvent('dash-scroll', { restore: true });
                _this.dashboard.startRefresh();
            });
        });
        this.canSaveAs = contextSrv.hasEditPermissionInFolders;
        this.canSave = this.dashboard.meta.canSave;
        this.canDelete = this.dashboard.meta.canSave;
        this.buildSectionList();
        this.onRouteUpdated();
        this.$rootScope.onAppEvent('$routeUpdate', this.onRouteUpdated.bind(this), $scope);
        this.$rootScope.appEvent('dash-scroll', { animate: false, pos: 0 });
        this.$rootScope.onAppEvent('dashboard-saved', this.onPostSave.bind(this), $scope);
    }
    SettingsCtrl.prototype.buildSectionList = function () {
        var e_1, _a;
        this.sections = [];
        if (this.dashboard.meta.canEdit) {
            this.sections.push({
                title: 'General',
                id: 'settings',
                icon: 'gicon gicon-preferences',
            });
            this.sections.push({
                title: 'Annotations',
                id: 'annotations',
                icon: 'gicon gicon-annotation',
            });
            this.sections.push({
                title: 'Variables',
                id: 'templating',
                icon: 'gicon gicon-variable',
            });
            this.sections.push({
                title: 'Links',
                id: 'links',
                icon: 'gicon gicon-link',
            });
        }
        if (this.dashboard.id && this.dashboard.meta.canSave) {
            this.sections.push({
                title: 'Versions',
                id: 'versions',
                icon: 'fa fa-fw fa-history',
            });
        }
        if (this.dashboard.id && this.dashboard.meta.canAdmin) {
            this.sections.push({
                title: 'Permissions',
                id: 'permissions',
                icon: 'fa fa-fw fa-lock',
            });
        }
        if (this.dashboard.meta.canMakeEditable) {
            this.sections.push({
                title: 'General',
                icon: 'gicon gicon-preferences',
                id: 'make_editable',
            });
        }
        this.sections.push({
            title: 'JSON Model',
            id: 'dashboard_json',
            icon: 'gicon gicon-json',
        });
        var params = this.$location.search();
        var url = this.$location.path();
        try {
            for (var _b = tslib_1.__values(this.sections), _c = _b.next(); !_c.done; _c = _b.next()) {
                var section = _c.value;
                var sectionParams = _.defaults({ editview: section.id }, params);
                section.url = config.appSubUrl + url + '?' + $.param(sectionParams);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    SettingsCtrl.prototype.onRouteUpdated = function () {
        this.viewId = this.$location.search().editview;
        if (this.viewId) {
            this.json = angular.toJson(this.dashboard.getSaveModelClone(), true);
        }
        if (this.viewId === 'settings' && this.dashboard.meta.canMakeEditable) {
            this.viewId = 'make_editable';
        }
        var currentSection = _.find(this.sections, { id: this.viewId });
        if (!currentSection) {
            this.sections.unshift({
                title: 'Not found',
                id: '404',
                icon: 'fa fa-fw fa-warning',
            });
            this.viewId = '404';
        }
    };
    SettingsCtrl.prototype.openSaveAsModal = function () {
        this.dashboardSrv.showSaveAsModal();
    };
    SettingsCtrl.prototype.saveDashboard = function () {
        this.dashboardSrv.saveDashboard();
    };
    SettingsCtrl.prototype.saveDashboardJson = function () {
        var _this = this;
        this.dashboardSrv.saveJSONDashboard(this.json).then(function () {
            _this.$route.reload();
        });
    };
    SettingsCtrl.prototype.onPostSave = function () {
        this.hasUnsavedFolderChange = false;
    };
    SettingsCtrl.prototype.hideSettings = function () {
        var _this = this;
        var urlParams = this.$location.search();
        delete urlParams.editview;
        setTimeout(function () {
            _this.$rootScope.$apply(function () {
                _this.$location.search(urlParams);
            });
        });
    };
    SettingsCtrl.prototype.makeEditable = function () {
        this.dashboard.editable = true;
        this.dashboard.meta.canMakeEditable = false;
        this.dashboard.meta.canEdit = true;
        this.dashboard.meta.canSave = true;
        this.canDelete = true;
        this.viewId = 'settings';
        this.buildSectionList();
        var currentSection = _.find(this.sections, { id: this.viewId });
        this.$location.url(currentSection.url);
    };
    SettingsCtrl.prototype.deleteDashboard = function () {
        var _this = this;
        var confirmText = '';
        var text2 = this.dashboard.title;
        var alerts = _.sumBy(this.dashboard.panels, function (panel) {
            return panel.alert ? 1 : 0;
        });
        if (alerts > 0) {
            confirmText = 'DELETE';
            text2 = "This dashboard contains " + alerts + " alerts. Deleting this dashboard will also delete those alerts";
        }
        appEvents.emit('confirm-modal', {
            title: 'Delete',
            text: 'Do you want to delete this dashboard?',
            text2: text2,
            icon: 'fa-trash',
            confirmText: confirmText,
            yesText: 'Delete',
            onConfirm: function () {
                _this.dashboard.meta.canSave = false;
                _this.deleteDashboardConfirmed();
            },
        });
    };
    SettingsCtrl.prototype.deleteDashboardConfirmed = function () {
        var _this = this;
        this.backendSrv.deleteDashboard(this.dashboard.uid).then(function () {
            appEvents.emit('alert-success', ['Dashboard Deleted', _this.dashboard.title + ' has been deleted']);
            _this.$location.url('/');
        });
    };
    SettingsCtrl.prototype.onFolderChange = function (folder) {
        this.dashboard.meta.folderId = folder.id;
        this.dashboard.meta.folderTitle = folder.title;
        this.hasUnsavedFolderChange = true;
    };
    SettingsCtrl.prototype.getFolder = function () {
        return {
            id: this.dashboard.meta.folderId,
            title: this.dashboard.meta.folderTitle,
            url: this.dashboard.meta.folderUrl,
        };
    };
    return SettingsCtrl;
}());
export { SettingsCtrl };
export function dashboardSettings() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/DashboardSettings/template.html',
        controller: SettingsCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        transclude: true,
        scope: { dashboard: '=' },
    };
}
coreModule.directive('dashboardSettings', dashboardSettings);
//# sourceMappingURL=SettingsCtrl.js.map