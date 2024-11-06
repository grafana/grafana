import { ReactNode, createContext, useEffect, useMemo, useState, useContext } from 'react';

import { TimeRange } from '@grafana/data';

type TimeRangeContextValue = TimeRangeContextHookValue & {
  // These are to be used internally and aren't passed to the users of the hook.

  // Called when picker is mounted to update the picker count.
  addPicker(): void;

  // Called when picker is unmounted to update the picker count.
  removePicker(): void;
};

export type TimeRangeContextHookValue = {
  // If the time range is synced, this is the value that all pickers should show.
  syncedValue?: TimeRange;

  // If the time range is synced across all visible pickers.
  synced: boolean;

  // If it is possible to sync the time range. This is based just on the number of pickers that are visible so if
  // there is only one, the sync button can be hidden.
  syncPossible: boolean;

  // Action passed to the picker to interact with the sync state.
  // Sync the time range across all pickers with the provided value. Can be also used just to update a value when
  // already synced.
  sync(value: TimeRange): void;
  unSync(): void;
};

const TimeRangeContext = createContext<TimeRangeContextValue | undefined>(undefined);

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  // We simply keep the count of the pickers visible by letting them call the addPicker and removePicker functions.
  const [pickersCount, setPickersCount] = useState(0);
  const [syncedValue, setSyncedValue] = useState<TimeRange>();

  const contextVal = useMemo(() => {
    return {
      sync: (value: TimeRange) => setSyncedValue(value),
      unSync: () => setSyncedValue(undefined),
      addPicker: () => setPickersCount((val) => val + 1),
      removePicker: () => {
        setPickersCount((val) => {
          const newVal = val - 1;
          if (newVal < 2) {
            setSyncedValue(undefined);
          }
          return newVal;
        });
      },
      syncPossible: pickersCount > 1,
      synced: Boolean(syncedValue),
      syncedValue,
    };
  }, [pickersCount, syncedValue]);

  return <TimeRangeContext.Provider value={contextVal}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRangeContext(initialSyncValue?: TimeRange): TimeRangeContextHookValue | undefined {
  const context = useContext(TimeRangeContext);

  // Automatically add and remove the picker when the component mounts and unmounts or if context changes (but that
  // should not happen). We ignore the initialSyncValue to make this value really just an initial value and isn't a
  // prop by which you could control the picker.
  useEffect(() => {
    // We want the pickers to still function even if they are not used in a context. Not sure, this will be a common
    // usecase, but it does not seem like it will cost us anything.
    if (context) {
      context.addPicker();
      if (initialSyncValue) {
        context.sync(initialSyncValue);
      }
      return () => {
        context.removePicker();
      };
    }
    return () => {};
    // We want to do this only on mount and unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(() => {
    // We want the pickers to still function even if they are not used in a context. Not sure, this will be a common
    // usecase, but it does not seem like it will cost us anything.
    if (!context) {
      return context;
    }

    // We just remove the addPicker/removePicker function as that is done automatically here and picker does not need
    // them.
    return {
      sync: context.sync,
      unSync: context.unSync,
      syncPossible: context.syncPossible,
      synced: context.synced,
      syncedValue: context.syncedValue,
    };
  }, [context]);
}
