import coreModule from 'app/core/core_module';
var AlertSrv = /** @class */ (function () {
    function AlertSrv() {
    }
    AlertSrv.prototype.set = function () {
        console.log('old depricated alert srv being used');
    };
    return AlertSrv;
}());
export { AlertSrv };
// this is just added to not break old plugins that might be using it
coreModule.service('alertSrv', AlertSrv);
//# sourceMappingURL=alert_srv.js.map