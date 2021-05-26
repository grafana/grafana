import { RawTimeRange } from './time';

/** @internal */
export interface ExploreUrlState {
  datasource: string;
  queries: any[]; // Should be a DataQuery, but we're going to strip refIds, so typing makes less sense
  range: RawTimeRange;
  originPanelId?: number;
  context?: string;
}
