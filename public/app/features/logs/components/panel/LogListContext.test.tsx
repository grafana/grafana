import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';

import { createLogLine } from '../mocks/logRow';

import {
  useLogListContextData,
  useLogListContext,
  useLogIsPinned,
  LogListContext,
  useLogIsPermalinked,
} from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

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
