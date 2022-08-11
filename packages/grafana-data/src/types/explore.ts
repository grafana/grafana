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

/**
 * SplitOpen type is used in Explore and related components.
 */
export type SplitOpen = <T extends DataQuery = any>(
  options?: { datasourceUid: string; query: T; range?: TimeRange; panelsState?: ExplorePanelsState } | undefined
) => void;

export type ExplorePanelProps = {
  graphStyle: ExploreGraphStyle;
  onChangeGraphStyle: (style: ExploreGraphStyle) => void;
  data: DataFrame[];
  absoluteRange: AbsoluteTimeRange;
  range: TimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  annotations?: DataFrame[];
  loadingState: LoadingState;
  // ...
  // And some more
}
