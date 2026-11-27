import { type LoadingState } from './data';
import { type DataFrame } from './dataFrame';
import { type DataLinkPostProcessor } from './fieldOverrides';
import { type AdHocVariableFilter } from './templateVars';
import { type TimeRange, type TimeZone } from './time';

/**
 * Host-supplied props for an exposed component that opts into discovery.
 * `discovery.props` describes only additional props, passed alongside these reserved props.
 *
 * @alpha
 */
export interface DiscoverableComponentProps {
  /** Datasource instance whose type matches `discovery.datasource`. */
  datasource: { uid: string; type: string };
  /** Resolved time range selected by the host. */
  timeRange: TimeRange;
  /** Filters selected by the host. Empty when none are selected. */
  filters: AdHocVariableFilter[];
  /** Emit only events declared in `discovery.events`, with a payload only if declared. */
  onEvent?: (event: { name: string; payload?: unknown }) => void;
}

/**
 * Props for the PrometheusQueryResults exposed component.
 * @see PluginExtensionExposedComponents.PrometheusQueryResultsV1
 */
export type PrometheusQueryResultsV1Props = {
  /** Raw DataFrames to display (processing handled internally). Defaults to empty array. */
  tableResult?: DataFrame[];
  /** Width of the container in pixels. Defaults to 800. */
  width?: number;
  /** Timezone for value formatting. Defaults to 'browser'. */
  timeZone?: TimeZone;
  /** Loading state for panel chrome indicator */
  loading?: LoadingState;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** When true, shows Table/Raw toggle and starts in Raw view. When false/undefined, shows table only without toggle. */
  showRawPrometheus?: boolean;
  /** Callback when user adds a cell filter */
  onCellFilterAdded?: (filter: { key: string; value: string; operator: '=' | '!=' }) => void;
  /** Optional post-processor for data links (used by Explore for split view) */
  dataLinkPostProcessor?: DataLinkPostProcessor;
};
