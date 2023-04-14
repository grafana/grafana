import { PreferredVisualisationType } from './data';
import { DataQuery } from './query';
import { RawTimeRange, TimeRange } from './time';

type AnyQuery = DataQuery & Record<string, any>;

/** @internal */
export interface ExploreUrlState<T extends DataQuery = AnyQuery> {
  datasource: string;
  queries: T[];
  range: RawTimeRange;
  context?: string;
  panelsState?: ExplorePanelsState;
}

export interface ExplorePanelsState extends Partial<Record<PreferredVisualisationType, {}>> {
  trace?: ExploreTracePanelState;
}

export interface ExploreTracePanelState {
  spanId?: string;
}

export interface SplitOpenOptions<T extends AnyQuery = AnyQuery> {
  datasourceUid: string;
  /** @deprecated Will be removed in a future version. Use queries instead. */
  query?: T;
  queries?: T[];
  range?: TimeRange;
  panelsState?: ExplorePanelsState;
}

/**
 * SplitOpen type is used in Explore and related components.
 */
export type SplitOpen = (options?: SplitOpenOptions | undefined) => void;
