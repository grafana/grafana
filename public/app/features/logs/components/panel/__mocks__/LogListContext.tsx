import { createContext, useContext } from 'react';

import { CoreApp, LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LogListContextData, Props } from '../LogListContext';

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  filterLevels: [],
  setDedupStrategy: () => {},
  setDisplayedFields: () => {},
  setFilterLevels: () => {},
  setLogListState: () => {},
  setPinnedLogs: () => {},
  setShowTime: () => {},
  setSortOrder: () => {},
  setSyntaxHighlighting: () => {},
  setWrapLogMessage: () => {},
  showTime: true,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: true,
  wrapLogMessage: false,
});

export const useLogListContextData = (key: keyof LogListContextData) => {
  const data: LogListContextData = useContext(LogListContext);
  return data[key];
};

export const useLogListContext = (): LogListContextData => {
  return useContext(LogListContext);
};

export const useLogIsPinned = (log: LogRowModel) => {
  const { pinnedLogs } = useContext(LogListContext);
  return pinnedLogs?.some((logId) => logId === log.rowId);
};

export const defaultProps = {
  app: CoreApp.Explore,
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  filterLevels: [],
  getRowContextQuery: jest.fn(),
  logSupportsContext: jest.fn(),
  onPermalinkClick: jest.fn(),
  onPinLine: jest.fn(),
  onOpenContext: jest.fn(),
  onUnpinLine: jest.fn(),
  pinnedLogs: [],
  setDedupStrategy: jest.fn(),
  setDisplayedFields: jest.fn(),
  setFilterLevels: jest.fn(),
  setLogListState: jest.fn(),
  setPinnedLogs: jest.fn(),
  setShowTime: jest.fn(),
  setSortOrder: jest.fn(),
  setSyntaxHighlighting: jest.fn(),
  setWrapLogMessage: jest.fn(),
  showControls: true,
  showTime: true,
  sortOrder: LogsSortOrder.Descending,
  syntaxHighlighting: true,
  wrapLogMessage: true,
};

export const LogListContextProvider = ({
  app = CoreApp.Explore,
  children,
  dedupStrategy = LogsDedupStrategy.none,
  displayedFields = [],
  filterLevels = [],
  getRowContextQuery = jest.fn(),
  logSupportsContext = jest.fn(),
  onPermalinkClick = jest.fn(),
  onPinLine = jest.fn(),
  onOpenContext = jest.fn(),
  onUnpinLine = jest.fn(),
  pinnedLogs = [],
  showTime = true,
  sortOrder = LogsSortOrder.Descending,
  syntaxHighlighting = true,
  wrapLogMessage = true,
}: Partial<Props>) => {
  return (
    <LogListContext.Provider
      value={{
        app,
        dedupStrategy,
        displayedFields,
        filterLevels,
        getRowContextQuery,
        logSupportsContext,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        pinnedLogs,
        setDedupStrategy: jest.fn(),
        setDisplayedFields: jest.fn(),
        setFilterLevels: jest.fn(),
        setLogListState: jest.fn(),
        setPinnedLogs: jest.fn(),
        setShowTime: jest.fn(),
        setSortOrder: jest.fn(),
        setSyntaxHighlighting: jest.fn(),
        setWrapLogMessage: jest.fn(),
        showTime,
        sortOrder,
        syntaxHighlighting,
        wrapLogMessage,
      }}
    >
      {children}
    </LogListContext.Provider>
  );
};
