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
    if (old.xaxis && !item.timeColumn) {
      item.timeColumn = old.xaxis;
    }

    if (old.yaxis && !item.valueColumn) {
      item.valueColumn = old.yaxis;
    }

    if (old.spliton && !item.segmentColumn) {
      item.segmentColumn = old.spliton;
    }

    return {
      type: 'timeSeriesQuery',
      refId: target.refId,
      queryType: AzureQueryType.InsightsAnalytics,
      insightsAnalytics: {
        rawQueryString: getTemplateSrv().replace(item.rawQueryString, scopedVars),
        timeColumn: item.timeColumn,
        valueColumn: item.valueColumn,
        segmentColumn: item.segmentColumn,
      },
    };
  }
}
