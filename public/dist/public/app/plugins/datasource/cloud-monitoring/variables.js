import { __extends } from "tslib";
import { from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { CustomVariableSupport } from '@grafana/data';
import CloudMonitoringMetricFindQuery from './CloudMonitoringMetricFindQuery';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
var CloudMonitoringVariableSupport = /** @class */ (function (_super) {
    __extends(CloudMonitoringVariableSupport, _super);
    function CloudMonitoringVariableSupport(datasource) {
        var _this = _super.call(this) || this;
        _this.datasource = datasource;
        _this.editor = CloudMonitoringVariableQueryEditor;
        _this.metricFindQuery = new CloudMonitoringMetricFindQuery(datasource);
        _this.query = _this.query.bind(_this);
        return _this;
    }
    CloudMonitoringVariableSupport.prototype.query = function (request) {
        var executeObservable = from(this.metricFindQuery.execute(request.targets[0]));
        return from(this.datasource.ensureGCEDefaultProject()).pipe(mergeMap(function () { return executeObservable; }), map(function (data) { return ({ data: data }); }));
    };
    return CloudMonitoringVariableSupport;
}(CustomVariableSupport));
export { CloudMonitoringVariableSupport };
//# sourceMappingURL=variables.js.map