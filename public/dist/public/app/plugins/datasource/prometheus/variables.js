import { __assign, __extends } from "tslib";
import { from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { rangeUtil, StandardVariableSupport, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import PrometheusMetricFindQuery from './metric_find_query';
import { getTimeSrv } from '../../../features/dashboard/services/TimeSrv';
var PrometheusVariableSupport = /** @class */ (function (_super) {
    __extends(PrometheusVariableSupport, _super);
    function PrometheusVariableSupport(datasource, templateSrv, timeSrv) {
        if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _this = _super.call(this) || this;
        _this.datasource = datasource;
        _this.templateSrv = templateSrv;
        _this.timeSrv = timeSrv;
        _this.query = _this.query.bind(_this);
        return _this;
    }
    PrometheusVariableSupport.prototype.query = function (request) {
        var query = request.targets[0].expr;
        if (!query) {
            return of({ data: [] });
        }
        var scopedVars = __assign(__assign(__assign({}, request.scopedVars), { __interval: { text: this.datasource.interval, value: this.datasource.interval }, __interval_ms: {
                text: rangeUtil.intervalToMs(this.datasource.interval),
                value: rangeUtil.intervalToMs(this.datasource.interval),
            } }), this.datasource.getRangeScopedVars(this.timeSrv.timeRange()));
        var interpolated = this.templateSrv.replace(query, scopedVars, this.datasource.interpolateQueryExpr);
        var metricFindQuery = new PrometheusMetricFindQuery(this.datasource, interpolated);
        var metricFindStream = from(metricFindQuery.process());
        return metricFindStream.pipe(map(function (results) { return ({ data: results }); }));
    };
    PrometheusVariableSupport.prototype.toDataQuery = function (query) {
        return {
            refId: 'PrometheusDatasource-VariableQuery',
            expr: query.query,
        };
    };
    return PrometheusVariableSupport;
}(StandardVariableSupport));
export { PrometheusVariableSupport };
//# sourceMappingURL=variables.js.map