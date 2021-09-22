import { DataQuery } from './query';
import { RawTimeRange, TimeRange } from './time';
import { Observable } from 'rxjs';
import { DataQueryResponse } from './datasource';

type AnyQuery = DataQuery & Record<string, any>;

/** @internal */
export interface ExploreUrlState<T extends DataQuery = AnyQuery> {
  datasource: string;
  queries: T[];
  range: RawTimeRange;
  originPanelId?: number;
  context?: string;
}

/**
 * SplitOpen type is used in Explore and related components.
 */
export type SplitOpen = <T extends DataQuery = any>(
  options?: { datasourceUid: string; query: T; range?: TimeRange } | undefined
) => void;

/**
 * Object with this interface should be returned by getLogsVolumeDataProvider
 * if such method is implemented in an DataSourceApi object.
 *
 * It's used internally in Explore only at the moment but could be moved to
 * @grafana/data and DataSourceApi if it's implemented in other data sources.
 *
 * @internal
 */
export interface RelatedDataProvider {
  getData(): Observable<DataQueryResponse>;
}
