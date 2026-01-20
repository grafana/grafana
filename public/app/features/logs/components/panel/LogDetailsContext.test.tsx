import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';

import { createLogLine } from '../mocks/logRow';

import {
  useLogDetailsContextData,
  useLogDetailsContext,
  LogDetailsContext,
  LogDetailsContextData,
} from './LogDetailsContext';

const log = createLogLine({ rowId: 'yep', uid: 'uid' });
const contextValue: LogDetailsContextData = {
  currentLog: log,
  closeDetails: () => {},
  detailsDisplayed: () => false,
  detailsMode: 'sidebar',
  detailsWidth: 1337,
  enableLogDetails: false,
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
