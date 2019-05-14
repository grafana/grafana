import config from 'app/core/config';
import coreModule from '../core_module';
var SignUpCtrl = /** @class */ (function () {
    /** @ngInject */
    function SignUpCtrl($scope, backendSrv, $location, contextSrv) {
        this.$scope = $scope;
        this.backendSrv = backendSrv;
        contextSrv.sidemenu = false;
        $scope.ctrl = this;
        $scope.formModel = {};
        var params = $location.search();
        // validate email is semi ok
        if (params.email && !params.email.match(/^\S+@\S+$/)) {
            console.log('invalid email');
            return;
        }
        $scope.formModel.orgName = params.email;
        $scope.formModel.email = params.email;
        $scope.formModel.username = params.email;
        $scope.formModel.code = params.code;
        $scope.verifyEmailEnabled = false;
        $scope.autoAssignOrg = false;
        $scope.navModel = {
            main: {
                icon: 'gicon gicon-branding',
                text: 'Sign Up',
                subTitle: 'Register your Grafana account',
                breadcrumbs: [{ title: 'Login', url: 'login' }],
            },
        };
        backendSrv.get('/api/user/signup/options').then(function (options) {
            $scope.verifyEmailEnabled = options.verifyEmailEnabled;
            $scope.autoAssignOrg = options.autoAssignOrg;
        });
    }
    SignUpCtrl.prototype.submit = function () {
        if (!this.$scope.signUpForm.$valid) {
            return;
        }
        this.backendSrv.post('/api/user/signup/step2', this.$scope.formModel).then(function (rsp) {
            if (rsp.code === 'redirect-to-select-org') {
                window.location.href = config.appSubUrl + '/profile/select-org?signup=1';
            }
            else {
                window.location.href = config.appSubUrl + '/';
            }
        });
    };
    return SignUpCtrl;
}());
export { SignUpCtrl };
coreModule.controller('SignUpCtrl', SignUpCtrl);
//# sourceMappingURL=signup_ctrl.js.map