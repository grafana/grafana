import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';

import { createLogLine } from '../__mocks__/logRow';

import { useLogListContextData, useLogListContext, useLogIsPinned, LogListContext } from './LogListContext';
import { defaultProps } from './__mocks__/LogListContext';

const log = createLogLine({ rowId: 'yep' });
const value = {
  ...defaultProps,
  getRowContextQuery: jest.fn(),
  logSupportsContext: jest.fn(),
  onPermalinkClick: jest.fn(),
  onPinLine: jest.fn(),
  onOpenContext: jest.fn(),
  onUnpinLine: jest.fn(),
  pinLineButtonTooltipTitle: 'test',
  pinnedLogs: ['yep'],
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

test('Allows to tell if a log is pinned', () => {
  const otherLog = createLogLine({ rowId: 'nope' });
  const { result } = renderHook(() => useLogIsPinned(otherLog), { wrapper });

  expect(result.current).toBe(false);
});
