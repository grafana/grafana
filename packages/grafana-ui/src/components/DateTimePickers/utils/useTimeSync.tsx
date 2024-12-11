import { useCallback, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { TimeRange } from '@grafana/data';

import { useTimeRangeContext } from '../TimeRangeContext';
import { TimeSyncButton } from '../TimeSyncButton';

/**
 * Handle the behaviour of the time sync button and syncing the time range between pickers. It also takes care of
 * backward compatibility with the manually controlled isSynced prop.
 * @param options
 */
export function useTimeSync(options: {
  initialIsSynced?: boolean;
  value: TimeRange;
  isSyncedProp?: boolean;
  timeSyncButtonProp?: JSX.Element;
  onChangeProp: (value: TimeRange) => void;
}) {
  const { value, onChangeProp, isSyncedProp, initialIsSynced, timeSyncButtonProp } = options;
  const timeRangeContext = useTimeRangeContext(initialIsSynced && value ? value : undefined);

  // Destructure to make it easier to use in hook deps.
  const timeRangeContextSynced = timeRangeContext?.synced;
  const timeRangeContextSyncedValue = timeRangeContext?.syncedValue;
  const timeRangeContextSyncFunc = timeRangeContext?.sync;

  // This is to determine if we should use the context to sync or not. This is for backward compatibility so that
  // Explore with multiple panes still works as it is controlling the sync state itself for now.
  const usingTimeRangeContext = Boolean(options.isSyncedProp === undefined && timeRangeContext);

  // Create new onChange that handles propagating the value to the context if possible and synced is true.
  const onChangeWithSync = useCallback(
    (timeRange: TimeRange) => {
      onChangeProp(timeRange);
      if (usingTimeRangeContext && timeRangeContextSynced) {
        timeRangeContextSyncFunc?.(timeRange);
      }
    },
    [onChangeProp, usingTimeRangeContext, timeRangeContextSyncFunc, timeRangeContextSynced]
  );

  const prevValue = usePrevious(value);
  const prevSyncedValue = usePrevious(timeRangeContext?.syncedValue);

  // As timepicker is controlled component we need to sync the global sync value back to the parent with onChange
  // handler whenever the outside global value changes. We do it here while checking if we are actually supposed
  // to and making sure we don't go into a loop.
  useEffect(() => {
    // only react if we are actually synced
    if (usingTimeRangeContext && timeRangeContextSynced) {
      if (value !== prevValue && value !== timeRangeContextSyncedValue) {
        // The value changed outside the picker. To keep the sync working we need to update the synced value.
        timeRangeContextSyncFunc?.(value);
      } else if (
        timeRangeContextSyncedValue &&
        timeRangeContextSyncedValue !== prevSyncedValue &&
        timeRangeContextSyncedValue !== value
      ) {
        // The global synced value changed, so we need to update the picker value.
        onChangeProp(timeRangeContextSyncedValue);
      }
    }
  }, [
    usingTimeRangeContext,
    timeRangeContextSynced,
    timeRangeContextSyncedValue,
    timeRangeContextSyncFunc,
    prevSyncedValue,
    value,
    prevValue,
    onChangeProp,
  ]);

  // Decide if we are in synced state or not. This is complicated by the manual controlled isSynced prop that is used
  // in Explore for now.
  const isSynced = usingTimeRangeContext ? timeRangeContext?.synced : isSyncedProp;

  // Again in Explore the sync button is controlled prop so here we also decide what kind of button to use.
  const button = usingTimeRangeContext
    ? timeRangeContext?.syncPossible && (
        <TimeSyncButton
          isSynced={timeRangeContext?.synced}
          onClick={() => (timeRangeContext?.synced ? timeRangeContext.unSync() : timeRangeContext.sync(value))}
        />
      )
    : timeSyncButtonProp;

  return {
    onChangeWithSync,
    isSynced,
    timeSyncButton: button,
  };
}
