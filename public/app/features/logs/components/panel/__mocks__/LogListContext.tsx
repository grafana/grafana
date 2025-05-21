import { createContext, useContext } from 'react';

import { CoreApp, LogRowModel, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

import { LogListContextData, Props } from '../LogListContext';

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  closeDetails: () => {},
  dedupStrategy: LogsDedupStrategy.none,
  detailsDisplayed: () => false,
  detailsWidth: 0,
  displayedFields: [],
  downloadLogs: () => {},
  enableLogDetails: false,
  filterLevels: [],
  hasUnescapedContent: false,
  setDedupStrategy: () => {},
  setDetailsWidth: () => {},
  setFilterLevels: () => {},
  setForceEscape: () => {},
  setLogListState: () => {},
  setPinnedLogs: () => {},
  setPrettifyJSON: () => {},
  setShowTime: () => {},
  setShowUniqueLabels: () => {},
  setSortOrder: () => {},
  setSyntaxHighlighting: () => {},
  setWrapLogMessage: () => {},
  showDetails: [],
  showTime: true,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: true,
  toggleDetails: () => {},
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

export const defaultValue: LogListContextData = {
  setDedupStrategy: jest.fn(),
  setFilterLevels: jest.fn(),
  setForceEscape: jest.fn(),
  setLogListState: jest.fn(),
  setPinnedLogs: jest.fn(),
  setShowTime: jest.fn(),
  setShowUniqueLabels: jest.fn(),
  setSortOrder: jest.fn(),
  setPrettifyJSON: jest.fn(),
  setSyntaxHighlighting: jest.fn(),
  setWrapLogMessage: jest.fn(),
  closeDetails: jest.fn(),
  detailsDisplayed: jest.fn(),
  detailsWidth: 0,
  downloadLogs: jest.fn(),
  enableLogDetails: false,
  filterLevels: [],
  setDetailsWidth: jest.fn(),
  showDetails: [],
  toggleDetails: jest.fn(),
  app: CoreApp.Explore,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  wrapLogMessage: false,
};

export const defaultProps: Props = {
  app: CoreApp.Explore,
  containerElement: document.createElement('div'),
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  enableLogDetails: false,
  filterLevels: [],
  getRowContextQuery: jest.fn(),
  logSupportsContext: jest.fn(),
  logs: [],
  onPermalinkClick: jest.fn(),
  onPinLine: jest.fn(),
  onOpenContext: jest.fn(),
  onUnpinLine: jest.fn(),
  pinnedLogs: [],
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
  enableLogDetails = false,
  filterLevels = [],
  getRowContextQuery = jest.fn(),
  logSupportsContext = jest.fn(),
  onLogLineHover,
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
        ...defaultValue,
        app,
        dedupStrategy,
        displayedFields,
        downloadLogs: jest.fn(),
        enableLogDetails,
        filterLevels,
        getRowContextQuery,
        logSupportsContext,
        onLogLineHover,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        pinnedLogs,
        setDedupStrategy: jest.fn(),
        setFilterLevels: jest.fn(),
        setForceEscape: jest.fn(),
        setLogListState: jest.fn(),
        setPinnedLogs: jest.fn(),
        setPrettifyJSON: jest.fn(),
        setShowTime: jest.fn(),
        setShowUniqueLabels: jest.fn(),
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
