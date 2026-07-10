import { useCallback, useSyncExternalStore } from 'react';

import { store } from '@grafana/data';

export const useStoredBoolean = (key: string, initialValue: boolean): [boolean, (value: boolean) => void] => {
  const subscribe = useCallback((onStoreChange: () => void) => store.subscribe(key, onStoreChange), [key]);
  const getSnapshot = useCallback(() => store.getBool(key, initialValue), [key, initialValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => initialValue);
  const setValue = useCallback((nextValue: boolean) => store.set(key, nextValue), [key]);

  return [value, setValue];
};
