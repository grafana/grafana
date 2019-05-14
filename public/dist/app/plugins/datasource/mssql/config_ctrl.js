var MssqlConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function MssqlConfigCtrl($scope) {
        this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
    }
    MssqlConfigCtrl.templateUrl = 'partials/config.html';
    return MssqlConfigCtrl;
}());
export { MssqlConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map