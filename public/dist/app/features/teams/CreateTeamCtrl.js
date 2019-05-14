import coreModule from 'app/core/core_module';
var CreateTeamCtrl = /** @class */ (function () {
    /** @ngInject */
    function CreateTeamCtrl(backendSrv, $location, navModelSrv) {
        this.backendSrv = backendSrv;
        this.$location = $location;
        this.navModel = navModelSrv.getNav('cfg', 'teams', 0);
    }
    CreateTeamCtrl.prototype.create = function () {
        var _this = this;
        var payload = {
            name: this.name,
            email: this.email,
        };
        this.backendSrv.post('/api/teams', payload).then(function (result) {
            if (result.teamId) {
                _this.$location.path('/org/teams/edit/' + result.teamId);
            }
        });
    };
    return CreateTeamCtrl;
}());
export { CreateTeamCtrl };
coreModule.controller('CreateTeamCtrl', CreateTeamCtrl);
//# sourceMappingURL=CreateTeamCtrl.js.map