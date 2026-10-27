import { render, renderHook, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createLogLine, createLogRow } from '../mocks/logRow';

import {
  useLogListContextData,
  useLogListContext,
  useLogIsPinned,
  LogListContext,
  LogListContextProvider,
  useLogIsPermalinked,
} from './LogListContext';
import { defaultProps, defaultValue } from './__mocks__/LogListContext';

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue({
      isLoading: false,
      isAvailable: true,
    }),
  };
});

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (_flag: string, defaultValue: boolean) => defaultValue,
}));

const log = createLogLine({ rowId: 'yep', uid: 'uid' });
const value = {
  ...defaultValue,
  pinnedLogs: ['yep'],
  permalinkedLogId: log.uid,
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <LogListContext.Provider value={value}>{children}</LogListContext.Provider>
);

test('Provides the Log List Context data', () => {
  const { result } = renderHook(() => useLogListContext(), { wrapper });

  expect(result.current).toEqual(value);
});

test('Allows to access context attributes', () => {
  const { result } = renderHook(() => useLogListContextData('pinnedLogs'), { wrapper });

  expect(result.current).toEqual(value.pinnedLogs);
});

test('Allows to tell if a log is pinned', () => {
  const { result } = renderHook(() => useLogIsPinned(log), { wrapper });

  expect(result.current).toBe(true);
});

test('Allows to tell if a log is not pinned', () => {
  const otherLog = createLogLine({ rowId: 'nope' });
  const { result } = renderHook(() => useLogIsPinned(otherLog), { wrapper });

  expect(result.current).toBe(false);
});

test('Allows to tell if a log is permalinked', () => {
  const { result } = renderHook(() => useLogIsPermalinked(log), { wrapper });

  expect(result.current).toBe(true);
});

test('Allows to tell if a log is not permalinked', () => {
  const otherLog = createLogLine({ rowId: 'nope' });
  const { result } = renderHook(() => useLogIsPermalinked(otherLog), { wrapper });

  expect(result.current).toBe(false);
});

function ErrorFieldsProbe() {
  const { hasLogsWithErrorAttributes } = useLogListContext();
  return <span>{hasLogsWithErrorAttributes ? 'error-fields' : 'no-error-fields'}</span>;
}

test('hasLogsWithErrorAttributes is true when a log has an error message or stack trace', () => {
  const log = createLogRow({ labels: { 'exception.stacktrace': 'at main' } });

  render(
    <LogListContextProvider {...defaultProps} logs={[log]}>
      <ErrorFieldsProbe />
    </LogListContextProvider>
  );

  expect(screen.getByText('error-fields')).toBeInTheDocument();
});

test('hasLogsWithErrorAttributes is false when logs have no error fields', () => {
  const log = createLogRow({ labels: { app: 'api', 'error.type': 'timeout' } });

  render(
    <LogListContextProvider {...defaultProps} logs={[log]}>
      <ErrorFieldsProbe />
    </LogListContextProvider>
  );

  expect(screen.getByText('no-error-fields')).toBeInTheDocument();
});

test('Identifies custom grammar', () => {
  const customWrapper = ({ children }: { children: ReactNode }) => (
    <LogListContext.Provider value={{ ...value, isCustomGrammar: true }}>{children}</LogListContext.Provider>
  );
  const { result } = renderHook(() => useLogListContext(), { wrapper: customWrapper });

  expect(result.current.isCustomGrammar).toBe(true);
});
