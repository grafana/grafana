var GraphiteConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function GraphiteConfigCtrl($scope, datasourceSrv) {
        this.graphiteVersions = [
            { name: '0.9.x', value: '0.9' },
            { name: '1.0.x', value: '1.0' },
            { name: '1.1.x', value: '1.1' },
        ];
        this.datasourceSrv = datasourceSrv;
        this.current.jsonData = this.current.jsonData || {};
        this.current.jsonData.graphiteVersion = this.current.jsonData.graphiteVersion || '0.9';
        this.autoDetectGraphiteVersion();
    }
    GraphiteConfigCtrl.prototype.autoDetectGraphiteVersion = function () {
        var _this = this;
        if (!this.current.id) {
            return;
        }
        this.datasourceSrv
            .loadDatasource(this.current.name)
            .then(function (ds) {
            return ds.getVersion();
        })
            .then(function (version) {
            _this.graphiteVersions.push({ name: version, value: version });
            _this.current.jsonData.graphiteVersion = version;
        });
    };
    GraphiteConfigCtrl.templateUrl = 'public/app/plugins/datasource/graphite/partials/config.html';
    return GraphiteConfigCtrl;
}());
export { GraphiteConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map