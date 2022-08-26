import { DataQuery } from '@grafana/data';

import pluginJson from './plugin.json';
import { AzureMonitorQuery, AzureQueryType } from './types';

export const isAzureMonitorQuery = (query: DataQuery): query is AzureMonitorQuery => {
  return query.datasource?.type === pluginJson.id || (query.queryType ?? '') in AzureQueryType;
};
