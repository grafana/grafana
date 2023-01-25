import { get } from 'lodash';

import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import CloudMonitoringCheatSheet from './components/CloudMonitoringCheatSheet';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import { QueryType } from './dataquery.gen';
import CloudMonitoringDatasource from './datasource';
import pluginJson from './plugin.json';
import { trackCloudMonitoringDashboardLoaded } from './tracking';
import { CloudMonitoringQuery } from './types';

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
      [QueryType.TimeSeriesQuery]: 0,
      [QueryType.TimeSeriesList]: 0,
      [QueryType.Slo]: 0,
      [QueryType.Annotation]: 0,
    };
    cloudmonitorQueries.forEach((query) => {
      if (
        query.queryType === QueryType.TimeSeriesQuery ||
        query.queryType === QueryType.TimeSeriesList ||
        query.queryType === QueryType.Slo ||
        query.queryType === QueryType.Annotation
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
        mql_queries: stats[QueryType.TimeSeriesQuery],
        time_series_filter_queries: stats[QueryType.TimeSeriesList],
        slo_queries: stats[QueryType.Slo],
        annotation_queries: stats[QueryType.Annotation],
      });
    }
  }
);
