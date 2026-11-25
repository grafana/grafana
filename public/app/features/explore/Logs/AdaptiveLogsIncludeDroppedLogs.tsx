import { type DataFrame, type LoadingState, type LogRowModel, type TimeRange } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { type LogsSortOrder, type DataQuery } from '@grafana/schema';

export const INCLUDE_DROPPED_LOGS_COMPONENT_ID = 'grafana-adaptivelogs-app/include-dropped-logs/v1';

/**
 * Indicate which logs are currently visible on screen (so we can include more in that range)
 */
export type RenderedLogsWindow = {
  startRowIndex: number;
  endRowIndex: number;
  logsSortOrder: LogsSortOrder;
};

/**
 * A callback for an external component to include additional logs into the view.
 */
export type IncludeAdditionalLogs = (frames: DataFrame[]) => Promise<IncludeAdditionalLogsResult>;

export type IncludeAdditionalLogsResult = {
  addedUniqueLogs: number;
  totalUniqueLogs: number;
};

type Props = {
  includeAdditionalLogs?: IncludeAdditionalLogs;
  logs: LogRowModel[];
  logsLoadingState: LoadingState;
  queries?: DataQuery[];
  renderedLogsWindow?: RenderedLogsWindow;
  queryTimeRange?: TimeRange;
};

export function AdaptiveLogsIncludeDroppedLogs(props: Props) {
  const { component: IncludeDroppedLogs, isLoading } = usePluginComponent<Props>(INCLUDE_DROPPED_LOGS_COMPONENT_ID);

  if (isLoading || !IncludeDroppedLogs || !props.queries?.length) {
    return null;
  }

  return <IncludeDroppedLogs {...props} />;
}
