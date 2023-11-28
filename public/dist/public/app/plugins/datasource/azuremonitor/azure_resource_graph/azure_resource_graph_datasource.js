// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { AzureQueryType } from '../types';
import { interpolateVariable } from '../utils/common';
export default class AzureResourceGraphDatasource extends DataSourceWithBackend {
    filterQuery(item) {
        var _a;
        return !!((_a = item.azureResourceGraph) === null || _a === void 0 ? void 0 : _a.query) && !!item.subscriptions && item.subscriptions.length > 0;
    }
    applyTemplateVariables(target, scopedVars) {
        const ts = getTemplateSrv();
        const item = target.azureResourceGraph;
        if (!item) {
            return target;
        }
        const variableNames = ts.getVariables().map((v) => `$${v.name}`);
        const subscriptionVar = _.find(target.subscriptions, (sub) => _.includes(variableNames, sub));
        const interpolatedSubscriptions = ts
            .replace(subscriptionVar, scopedVars, (v) => v)
            .split(',')
            .filter((v) => v.length > 0);
        const subscriptions = [
            ...interpolatedSubscriptions,
            ..._.filter(target.subscriptions, (sub) => !_.includes(variableNames, sub)),
        ];
        const query = ts.replace(item.query, scopedVars, interpolateVariable);
        return Object.assign(Object.assign({}, target), { queryType: AzureQueryType.AzureResourceGraph, subscriptions, azureResourceGraph: {
                resultFormat: 'table',
                query,
            } });
    }
}
//# sourceMappingURL=azure_resource_graph_datasource.js.map