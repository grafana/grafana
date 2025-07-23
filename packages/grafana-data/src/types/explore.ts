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

/**
 * @internal
 */
export interface TraceSearchProps {
  serviceName?: string;
  serviceNameOperator: string;
  spanName?: string;
  spanNameOperator: string;
  from?: string;
  fromOperator: string;
  to?: string;
  toOperator: string;
  tags: TraceSearchTag[];
  query?: string;
  matchesOnly: boolean;
  criticalPathOnly: boolean;
}

export interface TraceSearchTag {
  id: string;
  key?: string;
  operator: string;
  value?: string;
}

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

/**
 * Keep a list of vars the correlations editor / helper in explore will use
 *
 * vars can be modified by transformation variables, origVars is so we can rebuild the original list
 */
/** @internal */
export interface ExploreCorrelationHelperData {
  resultField: string;
  origVars: Record<string, string>;
  vars: Record<string, string>;
}

export interface ExploreTracePanelState {
  spanId?: string;
  spanFilters?: TraceSearchProps;
}

export interface ExploreLogsPanelState {
  id?: string;
  columns?: Record<number, string>;
  visualisationType?: 'table' | 'logs';
  labelFieldName?: string;
  // Used for logs table visualisation, contains the refId of the dataFrame that is currently visualized
  refId?: string;
  displayedFields?: string[];
}

export interface SplitOpenOptions<T extends AnyQuery = AnyQuery> {
  datasourceUid: string;
  queries: T[];
  range?: TimeRange;
  panelsState?: ExplorePanelsState;
  correlationHelperData?: ExploreCorrelationHelperData;
}

/**
 * SplitOpen type is used in Explore and related components.
 */
export type SplitOpen = (options?: SplitOpenOptions | undefined) => void;
