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
 * If indices are undefined, they are not visible (successfully fetched empty or filtered to zero)
 */
type RenderedLogsWindow = {
  startRowIndex: number | undefined;
  endRowIndex: number | undefined;
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

export function useRenderedLogsWindow(
  visualisationType: LogsVisualisationType,
  logsSortOrder: LogsSortOrder,
  hasData: boolean,
  loading: boolean
) {
  const timeMachineEnabled = useFlagAdaptivelogsEnableTimeMachine();
  const [renderedLogsWindowDebounced, setRenderedLogsWindowDebounced] = useState<RenderedLogsWindow | undefined>();

  const onRenderedLogsChanged = useMemo(
    () =>
      !timeMachineEnabled
        ? undefined
        : debounce((indices: ListOnItemsRenderedProps | undefined, logs: LogListModel[]) => {
            // debounce to avoid chain reaction on each scroll tick.
            setRenderedLogsWindowDebounced(
              indices
                ? {
                    startRowIndex: indices.visibleStartIndex,
                    endRowIndex: indices.visibleStopIndex,
                    logsSortOrder,
                    logs,
                  }
                : // `indices` are undefined when loading is done but no logs are currently visible (there were none, or they were filtered to zero) -
                  {
                    startRowIndex: undefined,
                    endRowIndex: undefined,
                    logsSortOrder,
                    logs: [],
                  }
            );
          }, 250),
    [logsSortOrder, timeMachineEnabled]
  );

  useEffect(() => () => onRenderedLogsChanged?.cancel(), [onRenderedLogsChanged]);

  // Masks the debounced value whenever it's stale (or incompatible) relative to the current display state
  const renderedLogsWindow = useMemo(() => {
    // The following cases disable via `undefined`
    if (
      // Time machine flag is off
      !timeMachineEnabled ||
      // Only the InfiniteScroll type is supported
      visualisationType !== 'logs' ||
      // If the "old" debounced value doesn't match a recent change, we disable until it catches up
      renderedLogsWindowDebounced?.logsSortOrder !== logsSortOrder ||
      // Still fetching - we don't know yet whether there's anything to show
      (loading && !hasData)
    ) {
      return undefined;
    }

    if (!hasData) {
      // Done loading, but no data
      return { startRowIndex: undefined, endRowIndex: undefined, logsSortOrder, logs: [] };
    }
    return renderedLogsWindowDebounced;
  }, [visualisationType, logsSortOrder, renderedLogsWindowDebounced, timeMachineEnabled, hasData, loading]);

  return { renderedLogsWindow, onRenderedLogsChanged };
}
