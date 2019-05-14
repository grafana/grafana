import { liveSrv } from 'app/core/core';
var DataObservable = /** @class */ (function () {
    function DataObservable(target) {
        this.target = target;
    }
    DataObservable.prototype.subscribe = function (options) {
        var observable = liveSrv.subscribe(this.target.stream);
        return observable.subscribe(function (data) {
            console.log('grafana stream ds data!', data);
        });
    };
    return DataObservable;
}());
var GrafanaStreamDS = /** @class */ (function () {
    /** @ngInject */
    function GrafanaStreamDS() {
    }
    GrafanaStreamDS.prototype.query = function (options) {
        if (options.targets.length === 0) {
            return Promise.resolve({ data: [] });
        }
        var target = options.targets[0];
        var observable = new DataObservable(target);
        return Promise.resolve(observable);
    };
    return GrafanaStreamDS;
}());
export { GrafanaStreamDS };
//# sourceMappingURL=datasource.js.map