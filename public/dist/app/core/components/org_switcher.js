import coreModule from 'app/core/core_module';
import { contextSrv } from 'app/core/services/context_srv';
import config from 'app/core/config';
var template = "\n<div class=\"modal-body\">\n\t<div class=\"modal-header\">\n\t\t<h2 class=\"modal-header-title\">\n\t\t\t<i class=\"fa fa-random\"></i>\n\t\t\t<span class=\"p-l-1\">Switch Organization</span>\n\t\t</h2>\n\n\t\t<a class=\"modal-header-close\" ng-click=\"ctrl.dismiss();\">\n\t\t\t<i class=\"fa fa-remove\"></i>\n\t\t</a>\n\t</div>\n\n  <div class=\"modal-content modal-content--has-scroll\" grafana-scrollbar>\n    <table class=\"filter-table form-inline\">\n\t\t\t<thead>\n\t\t\t\t<tr>\n\t\t\t\t\t<th>Name</th>\n\t\t\t\t\t<th>Role</th>\n\t\t\t\t\t<th></th>\n\t\t\t\t</tr>\n\t\t\t</thead>\n\t\t\t<tbody>\n\t\t\t\t<tr ng-repeat=\"org in ctrl.orgs\">\n\t\t\t\t\t<td>{{org.name}}</td>\n\t\t\t\t\t<td>{{org.role}}</td>\n\t\t\t\t\t<td class=\"text-right\">\n\t\t\t\t\t\t<span class=\"btn btn-primary btn-mini\" ng-show=\"org.orgId === ctrl.currentOrgId\">\n\t\t\t\t\t\t\tCurrent\n\t\t\t\t\t\t</span>\n\t\t\t\t\t\t<a ng-click=\"ctrl.setUsingOrg(org)\" class=\"btn btn-inverse btn-mini\" ng-show=\"org.orgId !== ctrl.currentOrgId\">\n\t\t\t\t\t\t\tSwitch to\n\t\t\t\t\t\t</a>\n\t\t\t\t\t</td>\n\t\t\t\t</tr>\n\t\t\t</tbody>\n\t\t</table>\n\t</div>\n</div>";
var OrgSwitchCtrl = /** @class */ (function () {
    /** @ngInject */
    function OrgSwitchCtrl(backendSrv) {
        this.backendSrv = backendSrv;
        this.currentOrgId = contextSrv.user.orgId;
        this.getUserOrgs();
    }
    OrgSwitchCtrl.prototype.getUserOrgs = function () {
        var _this = this;
        this.backendSrv.get('/api/user/orgs').then(function (orgs) {
            _this.orgs = orgs;
        });
    };
    OrgSwitchCtrl.prototype.setUsingOrg = function (org) {
        var _this = this;
        return this.backendSrv.post('/api/user/using/' + org.orgId).then(function () {
            _this.setWindowLocation(config.appSubUrl + (config.appSubUrl.endsWith('/') ? '' : '/') + '?orgId=' + org.orgId);
        });
    };
    OrgSwitchCtrl.prototype.setWindowLocation = function (href) {
        window.location.href = href;
    };
    return OrgSwitchCtrl;
}());
export { OrgSwitchCtrl };
export function orgSwitcher() {
    return {
        restrict: 'E',
        template: template,
        controller: OrgSwitchCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('orgSwitcher', orgSwitcher);
//# sourceMappingURL=org_switcher.js.map