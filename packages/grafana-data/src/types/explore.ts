import { DataQuery } from './query';
import { RawTimeRange, TimeRange } from './time';

type AnyQuery = DataQuery & Record<string, any>;

/** @internal */
export const EXPLORE_GRAPH_STYLES = ['lines', 'bars', 'points', 'stacked_lines', 'stacked_bars'] as const;

/** @internal */
export type ExploreGraphStyle = typeof EXPLORE_GRAPH_STYLES[number];

/** @internal */
export interface ExploreUrlState<T extends DataQuery = AnyQuery> {
  datasource: string;
  queries: T[];
  range: RawTimeRange;
  originPanelId?: number;
  context?: string;
  graphStyle?: ExploreGraphStyle;
}

/**
 * SplitOpen type is used in Explore and related components.
 */
export type SplitOpen = <T extends DataQuery = any>(
  options?: { datasourceUid: string; query: T; range?: TimeRange } | undefined
) => void;
