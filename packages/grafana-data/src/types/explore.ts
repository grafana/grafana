import { DataQuery } from '@grafana/schema';

import { PreferredVisualisationType } from './data';
import { RawTimeRange, TimeRange } from './time';

type AnyQuery = DataQuery & Record<string, any>;

/** @internal */
export interface ExploreUrlState<T extends DataQuery = AnyQuery> {
  datasource: string | null;
  queries: T[];
  range: RawTimeRange;
  panelsState?: ExplorePanelsState;
}

export interface ExplorePanelsState extends Partial<Record<PreferredVisualisationType, {}>> {
  trace?: ExploreTracePanelState;
  logs?: ExploreLogsPanelState;
}

export interface ExploreTracePanelState {
  spanId?: string;
}

export interface ExploreLogsPanelState {
  id?: string;
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
