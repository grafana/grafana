import { act } from '@testing-library/react';
import { useSyncExternalStore } from 'react';

import { type useDataSourceInstanceList } from '@grafana/runtime/unstable';

type ListHook = typeof useDataSourceInstanceList;

// Keeps the recording rules target discovery in its loading state until the returned function is called.
export function holdRecordingTargetDiscovery(hookMock: jest.MockedFunction<ListHook>, actualHook: ListHook) {
  let isReleased = false;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  function useHeldList(filters?: Parameters<ListHook>[0]) {
    const result = actualHook(filters);
    const released = useSyncExternalStore(subscribe, () => isReleased);
    return released ? result : { items: [], isLoading: true };
  }

  hookMock.mockImplementation(useHeldList);

  return () => {
    isReleased = true;
    act(() => listeners.forEach((listener) => listener()));
  };
}

export function failRecordingTargetDiscovery(hookMock: jest.MockedFunction<ListHook>) {
  hookMock.mockReturnValue({ items: [], isLoading: false, error: new Error('list request failed') });
}
