import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { store } from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import {
  emptyContextData,
  LogDetailsContextProvider,
  useLogDetailsContextData,
  useLogDetailsContext,
  LogDetailsContext,
  type LogDetailsContextData,
} from './LogDetailsContext';
import { type LogLineDetailsMode } from './LogLineDetails';

const log = createLogLine({ rowId: 'yep', uid: 'uid' });
const contextValue: LogDetailsContextData = {
  ...emptyContextData,
  currentLog: log,
  closeDetails: () => {},
  detailsDisplayed: () => false,
  detailsMode: 'sidebar',
  detailsWidth: 1337,
  enableLogDetails: false,
  replaceDetails: () => {},
  setCurrentLog: () => {},
  setDetailsMode: () => {},
  setDetailsWidth: () => {},
  showDetails: [],
  toggleDetails: () => {},
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <LogDetailsContext.Provider value={contextValue}>{children}</LogDetailsContext.Provider>
);

test('Provides the Log Details Context data', () => {
  const { result } = renderHook(() => useLogDetailsContext(), { wrapper });

  expect(result.current).toEqual(contextValue);
});

test('Allows to access context attributes', () => {
  const { result } = renderHook(() => useLogDetailsContextData('detailsWidth'), { wrapper });

  expect(result.current).toEqual(contextValue.detailsWidth);
});

describe('LogDetailsContextProvider', () => {
  const logA = createLogLine({ rowId: 'row-a', uid: 'log-a' });
  const logB = createLogLine({ rowId: 'row-b', uid: 'log-b' });
  const logs = [logA, logB];

  function providerWrapper(enableLogDetails: boolean, detailsMode: LogLineDetailsMode = 'sidebar') {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <LogDetailsContextProvider
          detailsMode={detailsMode}
          enableLogDetails={enableLogDetails}
          logs={logs}
          showControls={false}
        >
          {children}
        </LogDetailsContextProvider>
      );
    };
  }

  describe('toggleDetails', () => {
    test('opens the clicked log in the sidebar', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });

      expect(result.current.currentLog).toBe(logA);
      expect(result.current.showDetails).toEqual([logA]);
    });

    test('replaces the current sidebar log when opening a different log', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      act(() => {
        result.current.toggleDetails(logB);
      });

      expect(result.current.currentLog).toBe(logB);
      expect(result.current.showDetails).toEqual([logB]);
    });

    test('collapses details when toggling the already-open log', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      act(() => {
        result.current.toggleDetails(logA);
      });

      expect(result.current.currentLog).toBeUndefined();
      expect(result.current.showDetails).toEqual([]);
    });

    test('opens a new sidebar tab when a modifier key is pressed', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      act(() => {
        result.current.toggleDetails(logB, true);
      });

      expect(result.current.currentLog).toBe(logB);
      expect(result.current.showDetails).toEqual([logA, logB]);
    });

    test('appends a new details entry in inline mode without a modifier key', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true, 'inline'),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      act(() => {
        result.current.toggleDetails(logB);
      });

      expect(result.current.showDetails).toEqual([logA, logB]);
    });
  });

  describe('replaceDetails', () => {
    test('does nothing when log details are disabled', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(false),
      });

      act(() => {
        result.current.replaceDetails(logB);
      });

      expect(result.current.currentLog).toBeUndefined();
      expect(result.current.showDetails).toEqual([]);
    });

    test('does nothing when no log details are open', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.replaceDetails(logB);
      });

      expect(result.current.currentLog).toBeUndefined();
      expect(result.current.showDetails).toEqual([]);
    });

    test('replaces the open log when switching to a different row', () => {
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      expect(result.current.currentLog).toBe(logA);
      expect(result.current.showDetails).toEqual([logA]);

      act(() => {
        result.current.replaceDetails(logB);
      });

      expect(result.current.currentLog).toBe(logB);
      expect(result.current.showDetails).toEqual([logB]);
    });

    test('when the target uid is already expanded, updates currentLog without changing expanded list length', () => {
      const logARefreshed = createLogLine({ rowId: 'row-a-new', uid: 'log-a', timeEpochMs: 99_000 });
      const { result } = renderHook(() => useLogDetailsContext(), {
        wrapper: providerWrapper(true),
      });

      act(() => {
        result.current.toggleDetails(logA);
      });
      expect(result.current.showDetails).toEqual([logA]);

      act(() => {
        result.current.replaceDetails(logARefreshed);
      });

      expect(result.current.currentLog).toBe(logARefreshed);
      expect(result.current.showDetails).toEqual([logA]);
      expect(result.current.detailsDisplayed(logARefreshed)).toBe(true);
    });
  });
});

describe('prettifyDetailsJSON', () => {
  const storageKey = 'grafana.logs.test.prettifyDetailsJSON';
  const logs = [log];

  afterEach(() => {
    store.delete(`${storageKey}.prettifyDetailsJSON`);
  });

  function prettifyWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <LogDetailsContextProvider
          detailsMode="sidebar"
          enableLogDetails
          logOptionsStorageKey={storageKey}
          logs={logs}
          showControls={false}
        >
          {children}
        </LogDetailsContextProvider>
      );
    };
  }

  test('defaults to true', () => {
    const { result } = renderHook(() => useLogDetailsContext(), {
      wrapper: prettifyWrapper(),
    });

    expect(result.current.prettifyDetailsJSON).toBe(true);
  });

  test('setPrettifyDetailsJSON updates state and local storage', () => {
    const { result } = renderHook(() => useLogDetailsContext(), {
      wrapper: prettifyWrapper(),
    });

    act(() => {
      result.current.setPrettifyDetailsJSON(false);
    });

    expect(result.current.prettifyDetailsJSON).toBe(false);
    expect(store.getBool(`${storageKey}.prettifyDetailsJSON`, true)).toBe(false);
  });
});
