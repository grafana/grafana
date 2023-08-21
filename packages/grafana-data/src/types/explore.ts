import { DataQuery } from '@grafana/schema';

import { PreferredVisualisationType } from './data';
import { TimeRange } from './time';

type AnyQuery = DataQuery & Record<string, any>;

// enforce type-incompatibility with RawTimeRange to ensure it's parsed and converted.
// URLRangeValue may be a string representing UTC time in ms, which is not a compatible
// value for RawTimeRange when used as a string (it could only be an ISO formatted date)
export type URLRangeValue = string | { __brand: 'URL Range Value' };

/**
 * @internal
 */
export type URLRange = {
  from: URLRangeValue;
  to: URLRangeValue;
};

/** @internal */
export interface ExploreUrlState<T extends DataQuery = AnyQuery> {
  datasource: string | null;
  queries: T[];
  range: URLRange;
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
