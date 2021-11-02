import { __extends } from "tslib";
import { getTemplateSrv } from '@grafana/runtime';
import { AzureQueryType } from '../types';
import AppInsightsDatasource from '../app_insights/app_insights_datasource';
var InsightsAnalyticsDatasource = /** @class */ (function (_super) {
    __extends(InsightsAnalyticsDatasource, _super);
    function InsightsAnalyticsDatasource(instanceSettings) {
        return _super.call(this, instanceSettings) || this;
    }
    InsightsAnalyticsDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var item = target.insightsAnalytics;
        if (!item) {
            return target;
        }
        var query = item.rawQueryString && !item.query ? item.rawQueryString : item.query;
        return {
            refId: target.refId,
            queryType: AzureQueryType.InsightsAnalytics,
            insightsAnalytics: {
                query: getTemplateSrv().replace(query, scopedVars),
                resultFormat: item.resultFormat,
            },
        };
    };
    return InsightsAnalyticsDatasource;
}(AppInsightsDatasource));
export default InsightsAnalyticsDatasource;
//# sourceMappingURL=insights_analytics_datasource.js.map