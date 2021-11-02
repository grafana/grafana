import { createChangeHandler, createResetHandler, PasswordFieldEnum, } from '../../../features/datasources/utils/passwordHandlers';
var MssqlConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function MssqlConfigCtrl($scope) {
        this.current = $scope.ctrl.current;
        this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
        this.current.jsonData.authenticationType = this.current.jsonData.authenticationType || 'SQL Server Authentication';
        this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
        this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
        this.showUserCredentials = this.current.jsonData.authenticationType !== 'Windows Authentication';
    }
    MssqlConfigCtrl.prototype.onAuthenticationTypeChange = function () {
        // This is using the fallback in https://github.com/denisenkom/go-mssqldb to use Windows Auth if login/user id is empty.
        if (this.current.jsonData.authenticationType === 'Windows Authentication') {
            this.current.user = '';
            this.current.password = '';
        }
        this.showUserCredentials = this.current.jsonData.authenticationType !== 'Windows Authentication';
    };
    MssqlConfigCtrl.templateUrl = 'partials/config.html';
    return MssqlConfigCtrl;
}());
export { MssqlConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map