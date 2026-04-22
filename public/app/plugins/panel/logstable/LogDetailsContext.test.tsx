import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createLogLine } from 'app/features/logs/components/mocks/logRow';
import { type LogListModel } from 'app/features/logs/components/panel/processing';

import {
  emptyContextData,
  LogDetailsContext,
  LogDetailsContextProvider,
  type LogDetailsContextData,
  useLogDetailsContext,
  useLogDetailsContextData,
} from './LogDetailsContext';

const log1 = createLogLine({ uid: 'uid-1', rowId: 'row-1' });
const log2 = createLogLine({ uid: 'uid-2', rowId: 'row-2' });

const contextValue: LogDetailsContextData = {
  ...emptyContextData,
  currentLog: log1,
  closeDetails: () => {},
  detailsDisplayed: () => false,
  enableLogDetails: true,
  logs: [log1, log2],
  setCurrentLog: () => {},
  showDetails: [log1],
  toggleDetails: () => {},
};

const staticWrapper = ({ children }: { children: ReactNode }) => (
  <LogDetailsContext.Provider value={contextValue}>{children}</LogDetailsContext.Provider>
);

test('Provides the Log Details Context data', () => {
  const { result } = renderHook(() => useLogDetailsContext(), { wrapper: staticWrapper });

  expect(result.current).toEqual(contextValue);
});

test('Allows to access context attributes', () => {
  const { result } = renderHook(() => useLogDetailsContextData('enableLogDetails'), { wrapper: staticWrapper });

  expect(result.current).toEqual(contextValue.enableLogDetails);
});

function renderLogDetailsProviderHook(logs: LogListModel[], enableLogDetails = true) {
  const props = { logs, enableLogDetails };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <LogDetailsContextProvider enableLogDetails={props.enableLogDetails} logs={props.logs}>
      {children}
    </LogDetailsContextProvider>
  );
  const hook = renderHook(() => useLogDetailsContext(), { wrapper: Wrapper });
  return {
    ...hook,
    setProviderProps(next: Partial<{ logs: LogListModel[]; enableLogDetails: boolean }>) {
      Object.assign(props, next);
      hook.rerender();
    },
  };
}

describe('LogDetailsContextProvider', () => {
  test('starts with no details', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2]);

    expect(result.current.showDetails).toEqual([]);
    expect(result.current.currentLog).toBeUndefined();
    expect(result.current.detailsDisplayed(0)).toBe(false);
  });

  test('does not expand when log details are disabled', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2], false);

    act(() => {
      result.current.toggleDetails(0);
    });

    expect(result.current.showDetails).toEqual([]);
    expect(result.current.currentLog).toBeUndefined();
  });

  test('toggleDetails expands by row index and collapses on second toggle', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2]);

    act(() => {
      result.current.toggleDetails(0);
    });
    expect(result.current.showDetails.map((l) => l.uid)).toEqual([log1.uid]);
    expect(result.current.currentLog?.uid).toBe(log1.uid);
    expect(result.current.detailsDisplayed(0)).toBe(true);

    act(() => {
      result.current.toggleDetails(0);
    });
    expect(result.current.showDetails).toEqual([]);
    expect(result.current.currentLog).toBeUndefined();
    expect(result.current.detailsDisplayed(0)).toBe(false);
  });

  test('toggleDetails accepts a log model reference', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2]);

    act(() => {
      result.current.toggleDetails(log2);
    });
    expect(result.current.showDetails.map((l) => l.uid)).toEqual([log2.uid]);
    expect(result.current.currentLog?.uid).toBe(log2.uid);
  });

  test('when collapsing the active log with other rows expanded, currentLog moves to the last expanded row', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2]);

    act(() => {
      result.current.toggleDetails(0);
    });
    act(() => {
      result.current.toggleDetails(1);
    });
    expect(result.current.currentLog?.uid).toBe(log2.uid);

    act(() => {
      result.current.toggleDetails(1);
    });
    expect(result.current.currentLog?.uid).toBe(log1.uid);
    expect(result.current.showDetails.map((l) => l.uid)).toEqual([log1.uid]);
  });

  test('closeDetails clears expanded state', () => {
    const { result } = renderLogDetailsProviderHook([log1, log2]);

    act(() => {
      result.current.toggleDetails(0);
    });
    act(() => {
      result.current.closeDetails();
    });

    expect(result.current.showDetails).toEqual([]);
    expect(result.current.currentLog).toBeUndefined();
  });

  test('removes expanded rows that disappear from the logs prop', async () => {
    const { result, setProviderProps } = renderLogDetailsProviderHook([log1, log2]);

    act(() => {
      result.current.toggleDetails(0);
    });
    expect(result.current.showDetails).toHaveLength(1);

    setProviderProps({ logs: [log2] });

    await waitFor(() => {
      expect(result.current.showDetails).toEqual([]);
    });
  });
});
