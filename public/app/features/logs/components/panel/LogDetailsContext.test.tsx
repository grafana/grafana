import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createLogLine } from '../mocks/logRow';

import {
  LogDetailsContextProvider,
  useLogDetailsContextData,
  useLogDetailsContext,
  LogDetailsContext,
  type LogDetailsContextData,
} from './LogDetailsContext';

const log = createLogLine({ rowId: 'yep', uid: 'uid' });
const contextValue: LogDetailsContextData = {
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

describe('replaceDetails', () => {
  const logA = createLogLine({ rowId: 'row-a', uid: 'log-a' });
  const logB = createLogLine({ rowId: 'row-b', uid: 'log-b' });
  const logs = [logA, logB];

  function providerWrapper(enableLogDetails: boolean) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <LogDetailsContextProvider
          detailsMode="sidebar"
          enableLogDetails={enableLogDetails}
          logs={logs}
          showControls={false}
        >
          {children}
        </LogDetailsContextProvider>
      );
    };
  }

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
