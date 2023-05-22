import { get } from 'lodash';

import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import CloudMonitoringCheatSheet from './components/CloudMonitoringCheatSheet';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import CloudMonitoringDatasource from './datasource';
import pluginJson from './plugin.json';
import { trackCloudMonitoringDashboardLoaded } from './tracking';
import { CloudMonitoringQuery, QueryType } from './types/query';

export const plugin = new DataSourcePlugin<CloudMonitoringDatasource, CloudMonitoringQuery>(CloudMonitoringDatasource)
  .setQueryEditorHelp(CloudMonitoringCheatSheet)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CloudMonitoringVariableQueryEditor);

// Track dashboard loads to RudderStack
getAppEvents().subscribe<DashboardLoadedEvent<CloudMonitoringQuery>>(
  DashboardLoadedEvent,
  ({ payload: { dashboardId, orgId, grafanaVersion, queries } }) => {
    const cloudmonitorQueries = queries[pluginJson.id];
    let stats = {
      [QueryType.TIME_SERIES_QUERY]: 0,
      [QueryType.TIME_SERIES_LIST]: 0,
      [QueryType.SLO]: 0,
      [QueryType.ANNOTATION]: 0,
    };
    cloudmonitorQueries.forEach((query) => {
      if (
        query.queryType === QueryType.TIME_SERIES_QUERY ||
        query.queryType === QueryType.TIME_SERIES_LIST ||
        query.queryType === QueryType.SLO ||
        query.queryType === QueryType.ANNOTATION
      ) {
        stats[query.queryType]++;
      } else if (query.queryType === 'metrics') {
        if (query.hasOwnProperty('type') && get(query, 'type') === 'annotationQuery') {
          stats.annotation++;
        }
        if (get(query, 'metricQuery.editorMode') === 'mql') {
          stats.timeSeriesQuery++;
        } else {
          stats.timeSeriesList++;
        }
      }
    });

    if (cloudmonitorQueries && cloudmonitorQueries.length > 0) {
      trackCloudMonitoringDashboardLoaded({
        grafana_version: grafanaVersion,
        dashboard_id: dashboardId,
        org_id: orgId,
        mql_queries: stats[QueryType.TIME_SERIES_QUERY],
        time_series_filter_queries: stats[QueryType.TIME_SERIES_LIST],
        slo_queries: stats[QueryType.SLO],
        annotation_queries: stats[QueryType.ANNOTATION],
      });
    }
  }
);
