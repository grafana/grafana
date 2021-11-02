import { __extends, __read, __spreadArray } from "tslib";
// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import { AzureQueryType } from '../types';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { interpolateVariable } from '../utils/common';
var AzureResourceGraphDatasource = /** @class */ (function (_super) {
    __extends(AzureResourceGraphDatasource, _super);
    function AzureResourceGraphDatasource() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AzureResourceGraphDatasource.prototype.filterQuery = function (item) {
        var _a;
        return !!((_a = item.azureResourceGraph) === null || _a === void 0 ? void 0 : _a.query);
    };
    AzureResourceGraphDatasource.prototype.applyTemplateVariables = function (target, scopedVars) {
        var item = target.azureResourceGraph;
        if (!item) {
            return target;
        }
        var templateSrv = getTemplateSrv();
        var variableNames = templateSrv.getVariables().map(function (v) { return "$" + v.name; });
        var subscriptionVar = _.find(target.subscriptions, function (sub) { return _.includes(variableNames, sub); });
        var interpolatedSubscriptions = templateSrv
            .replace(subscriptionVar, scopedVars, function (v) { return v; })
            .split(',')
            .filter(function (v) { return v.length > 0; });
        var subscriptions = __spreadArray(__spreadArray([], __read(interpolatedSubscriptions), false), __read(_.filter(target.subscriptions, function (sub) { return !_.includes(variableNames, sub); })), false);
        var query = templateSrv.replace(item.query, scopedVars, interpolateVariable);
        return {
            refId: target.refId,
            queryType: AzureQueryType.AzureResourceGraph,
            subscriptions: subscriptions,
            azureResourceGraph: {
                resultFormat: 'table',
                query: query,
            },
        };
    };
    return AzureResourceGraphDatasource;
}(DataSourceWithBackend));
export default AzureResourceGraphDatasource;
//# sourceMappingURL=azure_resource_graph_datasource.js.map