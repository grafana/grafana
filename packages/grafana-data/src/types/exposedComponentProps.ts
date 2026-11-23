import { type LoadingState } from './data';
import { type DataFrame } from './dataFrame';
import { type DataLinkPostProcessor } from './fieldOverrides';
import { type TimeZone } from './time';

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

export type SaveResourceDrawerV1AlphaProps = {
  resource: {
    apiVersion?: string;
    kind?: string;
    metadata?: {
      name?: string;
      annotations?: Record<string, string | undefined>;
    };
    spec?: Record<string, unknown>;
  };
  title: string;
  readOnlyMessage?: string;
  branchPrefix?: string;
  directory?: string;
  onDismiss?: () => void;
} & ({ action: 'create'; repositoryName?: string } | { action: 'update' | 'delete'; repositoryName?: never });
