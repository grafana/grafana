import coreModule from 'app/core/core_module';
var UserInviteCtrl = /** @class */ (function () {
    /** @ngInject */
    function UserInviteCtrl(backendSrv, navModelSrv, $location) {
        this.backendSrv = backendSrv;
        this.$location = $location;
        this.navModel = navModelSrv.getNav('cfg', 'users', 0);
        this.invite = {
            name: '',
            email: '',
            role: 'Editor',
            sendEmail: true,
        };
    }
    UserInviteCtrl.prototype.sendInvite = function () {
        var _this = this;
        if (!this.inviteForm.$valid) {
            return;
        }
        return this.backendSrv.post('/api/org/invites', this.invite).then(function () {
            _this.$location.path('org/users/');
        });
    };
    return UserInviteCtrl;
}());
export { UserInviteCtrl };
coreModule.controller('UserInviteCtrl', UserInviteCtrl);
//# sourceMappingURL=UserInviteCtrl.js.map