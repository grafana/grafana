import angular from 'angular';
import _ from 'lodash';
export var iconMap = {
    'external link': 'fa-external-link',
    dashboard: 'fa-th-large',
    question: 'fa-question',
    info: 'fa-info',
    bolt: 'fa-bolt',
    doc: 'fa-file-text-o',
    cloud: 'fa-cloud',
};
var DashLinksEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function DashLinksEditorCtrl($scope, $rootScope) {
        this.iconMap = iconMap;
        this.dashboard.links = this.dashboard.links || [];
        this.mode = 'list';
        $scope.$on('$destroy', function () {
            $rootScope.appEvent('dash-links-updated');
        });
    }
    DashLinksEditorCtrl.prototype.backToList = function () {
        this.mode = 'list';
    };
    DashLinksEditorCtrl.prototype.setupNew = function () {
        this.mode = 'new';
        this.link = { type: 'dashboards', icon: 'external link' };
    };
    DashLinksEditorCtrl.prototype.addLink = function () {
        this.dashboard.links.push(this.link);
        this.mode = 'list';
        this.dashboard.updateSubmenuVisibility();
    };
    DashLinksEditorCtrl.prototype.editLink = function (link) {
        this.link = link;
        this.mode = 'edit';
        console.log(this.link);
    };
    DashLinksEditorCtrl.prototype.saveLink = function () {
        this.backToList();
    };
    DashLinksEditorCtrl.prototype.moveLink = function (index, dir) {
        _.move(this.dashboard.links, index, index + dir);
    };
    DashLinksEditorCtrl.prototype.deleteLink = function (index) {
        this.dashboard.links.splice(index, 1);
        this.dashboard.updateSubmenuVisibility();
    };
    return DashLinksEditorCtrl;
}());
export { DashLinksEditorCtrl };
function dashLinksEditor() {
    return {
        restrict: 'E',
        controller: DashLinksEditorCtrl,
        templateUrl: 'public/app/features/dashboard/components/DashLinks/editor.html',
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dashboard: '=',
        },
    };
}
angular.module('grafana.directives').directive('dashLinksEditor', dashLinksEditor);
//# sourceMappingURL=DashLinksEditorCtrl.js.map