import config from 'app/core/config';
import { coreModule } from 'app/core/core';
var ProfileCtrl = /** @class */ (function () {
    /** @ngInject */
    function ProfileCtrl(backendSrv, contextSrv, $location, navModelSrv) {
        this.backendSrv = backendSrv;
        this.contextSrv = contextSrv;
        this.$location = $location;
        this.teams = [];
        this.orgs = [];
        this.showTeamsList = false;
        this.showOrgsList = false;
        this.readonlyLoginFields = config.disableLoginForm;
        this.getUser();
        this.getUserTeams();
        this.getUserOrgs();
        this.navModel = navModelSrv.getNav('profile', 'profile-settings', 0);
    }
    ProfileCtrl.prototype.getUser = function () {
        var _this = this;
        this.backendSrv.get('/api/user').then(function (user) {
            _this.user = user;
            _this.user.theme = user.theme || 'dark';
        });
    };
    ProfileCtrl.prototype.getUserTeams = function () {
        var _this = this;
        this.backendSrv.get('/api/user/teams').then(function (teams) {
            _this.teams = teams;
            _this.showTeamsList = _this.teams.length > 0;
        });
    };
    ProfileCtrl.prototype.getUserOrgs = function () {
        var _this = this;
        this.backendSrv.get('/api/user/orgs').then(function (orgs) {
            _this.orgs = orgs;
            _this.showOrgsList = orgs.length > 1;
        });
    };
    ProfileCtrl.prototype.setUsingOrg = function (org) {
        this.backendSrv.post('/api/user/using/' + org.orgId).then(function () {
            window.location.href = config.appSubUrl + '/profile';
        });
    };
    ProfileCtrl.prototype.update = function () {
        var _this = this;
        if (!this.userForm.$valid) {
            return;
        }
        this.backendSrv.put('/api/user/', this.user).then(function () {
            _this.contextSrv.user.name = _this.user.name || _this.user.login;
            if (_this.oldTheme !== _this.user.theme) {
                window.location.href = config.appSubUrl + _this.$location.path();
            }
        });
    };
    return ProfileCtrl;
}());
export { ProfileCtrl };
coreModule.controller('ProfileCtrl', ProfileCtrl);
//# sourceMappingURL=ProfileCtrl.js.map