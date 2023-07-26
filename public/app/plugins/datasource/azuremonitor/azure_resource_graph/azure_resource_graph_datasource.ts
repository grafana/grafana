// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';

import { ScopedVars } from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';

import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType } from '../types';
import { interpolateVariable } from '../utils/common';

export default class AzureResourceGraphDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureDataSourceJsonData
> {
  filterQuery(item: AzureMonitorQuery): boolean {
    return !!item.azureResourceGraph?.query && !!item.subscriptions && item.subscriptions.length > 0;
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const item = target.azureResourceGraph;
    if (!item) {
      return target;
    }

    const templateSrv = getTemplateSrv();
    const variableNames = templateSrv.getVariables().map((v) => `$${v.name}`);
    const subscriptionVar = _.find(target.subscriptions, (sub) => _.includes(variableNames, sub));
    const interpolatedSubscriptions = templateSrv
      .replace(subscriptionVar, scopedVars, (v: string[] | string) => v)
      .split(',')
      .filter((v) => v.length > 0);
    const subscriptions = [
      ...interpolatedSubscriptions,
      ..._.filter(target.subscriptions, (sub) => !_.includes(variableNames, sub)),
    ];
    const query = templateSrv.replace(item.query, scopedVars, interpolateVariable);

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
}
