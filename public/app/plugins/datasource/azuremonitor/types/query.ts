import { AzureMonitorQuery as AzureMonitorQueryBase, AzureQueryType } from '../dataquery.gen';

export { AzureQueryType };
export {
  AzureMetricQuery,
  AzureLogsQuery,
  AzureResourceGraphQuery,
  AzureMonitorResource,
  AzureMetricDimension,
  ResultFormat,
} from '../dataquery.gen';

/**
 * Represents the query as it moves through the frontend query editor and datasource files.
 * It can represent new queries that are still being edited, so all properties are optional
 */
// TODO: This is a workaround until the type extensions issue is resolved in CUE
export interface AzureMonitorQuery extends AzureMonitorQueryBase {
  queryType?: AzureQueryType;
}
