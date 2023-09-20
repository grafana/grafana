// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';

import { ScopedVars, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend, VariableInterpolation } from '@grafana/runtime';

import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType } from '../types';
import { interpolateVariable } from '../utils/common';

export default class AzureResourceGraphDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureDataSourceJsonData
> {
  filterQuery(item: AzureMonitorQuery): boolean {
    return !!item.azureResourceGraph?.query && !!item.subscriptions && item.subscriptions.length > 0;
  }

  applyVars(target: AzureMonitorQuery, scopedVars: ScopedVars, getVars: () => TypedVariableModel[], replace: (target?: string | undefined, scopedVars?: ScopedVars | undefined, format?: string | Function | undefined, interpolations?: VariableInterpolation[] | undefined) => string): AzureMonitorQuery {
    const item = target.azureResourceGraph;
    if (!item) {
      return target;
    }
    const variableNames = getVars().map((v) => `$${v.name}`);
    const subscriptionVar = _.find(target.subscriptions, (sub) => _.includes(variableNames, sub));
    const interpolatedSubscriptions = replace(subscriptionVar, scopedVars, (v: string[] | string) => v)
      .split(',')
      .filter((v) => v.length > 0);
    const subscriptions = [
      ...interpolatedSubscriptions,
      ..._.filter(target.subscriptions, (sub) => !_.includes(variableNames, sub)),
    ];
    const query = replace(item.query, scopedVars, interpolateVariable);

    return {
      ...target,
      queryType: AzureQueryType.AzureResourceGraph,
      subscriptions,
      azureResourceGraph: {
        resultFormat: 'table',
        query,
      },
    };
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const templateSrv = getTemplateSrv();
    return this.applyVars(target, scopedVars, templateSrv.getVariables, templateSrv.replace)
  }
}
