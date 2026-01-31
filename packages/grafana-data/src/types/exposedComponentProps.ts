import { LoadingState } from './data';
import { DataFrame } from './dataFrame';
import { DataLinkPostProcessor } from './fieldOverrides';
import { TimeZone } from './time';

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
  /** Start in Raw view instead of Table view. When true, shows toggle. */
  showRawPrometheus?: boolean;
  /** Callback when user adds a cell filter */
  onCellFilterAdded?: (filter: { key: string; value: string; operator: '=' | '!=' }) => void;
  /** Optional post-processor for data links (used by Explore for split view) */
  dataLinkPostProcessor?: DataLinkPostProcessor;
};
