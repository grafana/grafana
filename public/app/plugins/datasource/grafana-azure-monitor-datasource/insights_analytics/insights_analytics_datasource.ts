import { ScopedVars, DataSourceInstanceSettings } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { AzureDataSourceJsonData, AzureMonitorQuery, AzureQueryType } from '../types';
import AppInsightsDatasource from '../app_insights/app_insights_datasource';

export default class InsightsAnalyticsDatasource extends AppInsightsDatasource {
  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const item = target.insightsAnalytics;
    if (!item) {
      return target;
    }

    const query = item.rawQueryString && !item.query ? item.rawQueryString : item.query;

    return {
      refId: target.refId,
      queryType: AzureQueryType.InsightsAnalytics,
      insightsAnalytics: {
        query: getTemplateSrv().replace(query, scopedVars),
        resultFormat: item.resultFormat,
      },
    };
  }
}
