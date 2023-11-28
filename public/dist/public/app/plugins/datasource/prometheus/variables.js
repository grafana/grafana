import { from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport, rangeUtil } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getTimeSrv } from '../../../features/dashboard/services/TimeSrv';
import { PromVariableQueryEditor } from './components/VariableQueryEditor';
import PrometheusMetricFindQuery from './metric_find_query';
export class PrometheusVariableSupport extends CustomVariableSupport {
    constructor(datasource, templateSrv = getTemplateSrv(), timeSrv = getTimeSrv()) {
        super();
        this.datasource = datasource;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
        this.editor = PromVariableQueryEditor;
    }
    query(request) {
        // Handling grafana as code from jsonnet variable queries which are strings and not objects
        // Previously, when using StandardVariableSupport
        // the variable query string was changed to be on the expr attribute
        // Now, using CustomVariableSupport,
        // the variable query is changed to the query attribute.
        // So, without standard variable support changing the query string to the expr attribute,
        // the variable query string is coming in as it is written in jsonnet,
        // where it is just a string. Here is where we handle that.
        let query;
        if (typeof request.targets[0] === 'string') {
            query = request.targets[0];
        }
        else {
            query = request.targets[0].query;
        }
        if (!query) {
            return of({ data: [] });
        }
        const scopedVars = Object.assign(Object.assign(Object.assign({}, request.scopedVars), { __interval: { text: this.datasource.interval, value: this.datasource.interval }, __interval_ms: {
                text: rangeUtil.intervalToMs(this.datasource.interval),
                value: rangeUtil.intervalToMs(this.datasource.interval),
            } }), this.datasource.getRangeScopedVars(this.timeSrv.timeRange()));
        const interpolated = this.templateSrv.replace(query, scopedVars, this.datasource.interpolateQueryExpr);
        const metricFindQuery = new PrometheusMetricFindQuery(this.datasource, interpolated);
        const metricFindStream = from(metricFindQuery.process());
        return metricFindStream.pipe(map((results) => ({ data: results })));
    }
}
//# sourceMappingURL=variables.js.map