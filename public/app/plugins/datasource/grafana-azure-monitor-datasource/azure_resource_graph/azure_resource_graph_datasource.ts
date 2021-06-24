// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType } from '../types';
import { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { getAzureCloud } from '../credentials';
import { getDeepLinkRoute } from '../api/routes';

export default class AzureResourceGraphDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureDataSourceJsonData
> {
  cloud: string;

  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.cloud = getAzureCloud(instanceSettings);
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return !!item.azureResourceGraph?.query;
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): Record<string, any> {
    const item = target.azureResourceGraph;

    const templateSrv = getTemplateSrv();

    const query = templateSrv.replace(item.query, scopedVars, this.interpolateVariable);

    return {
      refId: target.refId,
      format: target.format,
      queryType: AzureQueryType.AzureResourceGraph,
      subscriptions: target.subscriptions,
      azureResourceGraph: {
        resultFormat: 'table',
        query,
      },
    };
  }

  interpolateVariable(value: string, variable: { multi: any; includeAll: any }) {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return "'" + value + "'";
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _.map(value, (val) => {
      if (typeof value === 'number') {
        return value;
      }

      return "'" + val + "'";
    });
    return quotedValues.join(',');
  }
}
