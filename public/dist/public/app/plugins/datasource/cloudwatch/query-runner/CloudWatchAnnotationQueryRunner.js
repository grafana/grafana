import { map } from 'rxjs';
import { toDataQueryResponse } from '@grafana/runtime';
import { CloudWatchRequest } from './CloudWatchRequest';
// This class handles execution of CloudWatch annotation queries
export class CloudWatchAnnotationQueryRunner extends CloudWatchRequest {
    constructor(instanceSettings, templateSrv) {
        super(instanceSettings, templateSrv);
    }
    handleAnnotationQuery(queries, options) {
        return this.awsRequest(this.dsQueryEndpoint, {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries: queries.map((query) => {
                var _a, _b, _c, _d;
                return (Object.assign(Object.assign({}, query), { statistic: this.templateSrv.replace(query.statistic), region: this.templateSrv.replace(this.getActualRegion(query.region)), namespace: this.templateSrv.replace(query.namespace), metricName: this.templateSrv.replace(query.metricName), dimensions: this.convertDimensionFormat((_a = query.dimensions) !== null && _a !== void 0 ? _a : {}, {}), period: (_b = query.period) !== null && _b !== void 0 ? _b : '', actionPrefix: (_c = query.actionPrefix) !== null && _c !== void 0 ? _c : '', alarmNamePrefix: (_d = query.alarmNamePrefix) !== null && _d !== void 0 ? _d : '', type: 'annotationQuery', datasource: this.ref }));
            }),
        }).pipe(map((r) => {
            const frames = toDataQueryResponse(r).data;
            return { data: frames };
        }));
    }
}
//# sourceMappingURL=CloudWatchAnnotationQueryRunner.js.map