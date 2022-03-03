import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { AzureDataSourceJsonData, DeprecatedAzureQueryType } from '../../../types';
import AppInsightsDatasource from '../app_insights/app_insights_datasource';
import { DeprecatedAzureMonitorQuery } from '../types';

export default class InsightsAnalyticsDatasource extends AppInsightsDatasource {
  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
  }

  applyTemplateVariables(target: DeprecatedAzureMonitorQuery, scopedVars: ScopedVars): DeprecatedAzureMonitorQuery {
    const item = target.insightsAnalytics;
    if (!item) {
      return target;
    }

    const query = item.rawQueryString && !item.query ? item.rawQueryString : item.query;

    return {
      refId: target.refId,
      queryType: DeprecatedAzureQueryType.InsightsAnalytics,
      insightsAnalytics: {
        query: getTemplateSrv().replace(query, scopedVars),
        resultFormat: item.resultFormat,
      },
    };
  }
}
