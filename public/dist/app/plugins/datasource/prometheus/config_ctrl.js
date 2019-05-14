var PrometheusConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function PrometheusConfigCtrl($scope) {
        this.current.jsonData.httpMethod = this.current.jsonData.httpMethod || 'GET';
    }
    PrometheusConfigCtrl.templateUrl = 'public/app/plugins/datasource/prometheus/partials/config.html';
    return PrometheusConfigCtrl;
}());
export { PrometheusConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map