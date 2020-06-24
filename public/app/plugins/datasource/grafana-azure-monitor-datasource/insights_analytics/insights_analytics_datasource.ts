import { ScopedVars } from '@grafana/data';
import { DataSourceInstanceSettings } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { AzureDataSourceJsonData, AzureMonitorQuery, AzureQueryType } from '../types';
import AppInsightsDatasource from '../app_insights/app_insights_datasource';

export default class InsightsAnalyticsDatasource extends AppInsightsDatasource {
  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): Record<string, any> {
    const item = target.insightsAnalytics;

    // Old name migrations
    const old: any = item;
    if (old.rawQueryString && !item.query) {
      item.query = old.rawQueryString;
    }

    return {
      refId: target.refId,
      queryType: AzureQueryType.InsightsAnalytics,
      insightsAnalytics: {
        query: getTemplateSrv().replace(item.query, scopedVars),
        resultFormat: item.resultFormat,
      },
    };
  }
}
