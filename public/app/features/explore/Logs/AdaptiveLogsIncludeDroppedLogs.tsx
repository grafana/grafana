import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { type ListOnItemsRenderedProps } from 'react-window';

import { type DataFrame, type LoadingState, type LogRowModel, type TimeRange } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { useFlagAdaptivelogsEnableTimeMachine } from '@grafana/runtime/internal';
import { type LogsSortOrder, type DataQuery } from '@grafana/schema';
import { type LogListModel } from 'app/features/logs/components/panel/processing';

import { type LogsVisualisationType } from './constants';

const INCLUDE_DROPPED_LOGS_COMPONENT_ID = 'grafana-adaptivelogs-app/include-dropped-logs/v1';

/**
 * Indicate which logs are currently visible on screen (so we can include more in that range)
 */
type RenderedLogsWindow = {
  startRowIndex: number;
  endRowIndex: number;
  logsSortOrder: LogsSortOrder;
  /** The (potentially filtered) array of logs the indices apply to */
  logs: LogListModel[];
};

/**
 * A callback for an external component to include additional logs into the view.
 */
type IncludeAdditionalLogs = (frames: DataFrame[]) => Promise<IncludeAdditionalLogsResult>;

type IncludeAdditionalLogsResult = {
  addedUniqueLogs: number;
  totalUniqueLogs: number;
};

type Props = {
  includeAdditionalLogs?: IncludeAdditionalLogs;
  /** All unique fetched logs */
  logs: LogRowModel[];
  logsLoadingState: LoadingState;
  queries?: DataQuery[];
  renderedLogsWindow?: RenderedLogsWindow;
  queryTimeRange?: TimeRange;
};

export function AdaptiveLogsIncludeDroppedLogs(props: Props) {
  const timeMachineEnabled = useFlagAdaptivelogsEnableTimeMachine();
  const { component: IncludeDroppedLogs, isLoading } = usePluginComponent<Props>(INCLUDE_DROPPED_LOGS_COMPONENT_ID);

  // This should not occur. The renderedLogsWindow.logs should only get smaller than the total fetched logs (due to filtering)
  const renderedLogsExceedFetchedLogs = (props.renderedLogsWindow?.logs?.length ?? 0) > props.logs.length;

  if (
    !timeMachineEnabled ||
    isLoading ||
    !IncludeDroppedLogs ||
    !props.queries?.length ||
    renderedLogsExceedFetchedLogs
  ) {
    return null;
  }

  return <IncludeDroppedLogs {...props} />;
}

export function useRenderedLogsWindow(visualisationType: LogsVisualisationType, logsSortOrder: LogsSortOrder) {
  const timeMachineEnabled = useFlagAdaptivelogsEnableTimeMachine();
  const [renderedLogsWindowDebounced, setRenderedLogsWindowDebounced] = useState<RenderedLogsWindow | undefined>();

  const onRenderedLogsChanged = useMemo(
    () =>
      !timeMachineEnabled
        ? undefined
        : debounce((indices: ListOnItemsRenderedProps, logs: LogListModel[]) => {
            // debounce to avoid chain reaction on each scroll tick
            setRenderedLogsWindowDebounced({
              startRowIndex: indices.visibleStartIndex,
              endRowIndex: indices.visibleStopIndex,
              logsSortOrder,
              logs,
            });
          }, 250),
    [logsSortOrder, timeMachineEnabled]
  );

  useEffect(() => () => onRenderedLogsChanged?.cancel(), [onRenderedLogsChanged]);

  // Masks the debounced value whenever it's stale (or incompatible) relative to the current display state
  const renderedLogsWindow = useMemo(() => {
    // The following cases disable with rendered logs window via `undefined`
    if (
      // Time machine flag is off
      !timeMachineEnabled ||
      // Only the InfiniteScroll type is supported
      visualisationType !== 'logs' ||
      // If the "old" debounced value doesn't match a recent change, we disable until it does
      renderedLogsWindowDebounced?.logsSortOrder !== logsSortOrder //
    ) {
      return undefined;
    }
    return renderedLogsWindowDebounced;
  }, [visualisationType, logsSortOrder, renderedLogsWindowDebounced, timeMachineEnabled]);

  return { renderedLogsWindow, onRenderedLogsChanged };
}
