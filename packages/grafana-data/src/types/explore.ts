import { RawTimeRange } from './time';
import { LogsDedupStrategy } from './logs';

/** @internal */
export interface ExploreUrlState {
  datasource: string;
  queries: any[]; // Should be a DataQuery, but we're going to strip refIds, so typing makes less sense
  range: RawTimeRange;
  ui: ExploreUIState;
  originPanelId?: number;
  context?: string;
}

/** @internal */
export interface ExploreUIState {
  showingTable: boolean;
  showingGraph: boolean;
  showingLogs: boolean;
  dedupStrategy?: LogsDedupStrategy;
}
