import { CloudMonitoringQuery as CloudMonitoringQueryBase, QueryType } from '../dataquery.gen';

export { QueryType };
export { PreprocessorType, MetricKind, AlignmentTypes, ValueTypes, MetricFindQueryTypes } from '../dataquery.gen';
export type {
  TimeSeriesQuery,
  SLOQuery,
  TimeSeriesList,
  MetricQuery,
  PromQLQuery,
  LegacyCloudMonitoringAnnotationQuery,
  Filter,
} from '../dataquery.gen';

/**
 * Represents the query as it moves through the frontend query editor and datasource files.
 * It can represent new queries that are still being edited, so all properties are optional
 */
// TODO: This is a workaround until the type extensions issue is resolved in CUE
export interface CloudMonitoringQuery extends CloudMonitoringQueryBase {
  queryType?: QueryType;
}
