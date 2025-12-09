import { createContext, useContext } from 'react';

import { CoreApp, LogListStyle, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';
import { checkLogsError, checkLogsSampled } from 'app/features/logs/utils';

import { LogListContextData, Props } from '../LogListContext';
import { LogListModel } from '../processing';

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue({
      isAvailable: true,
    }),
  };
});

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  downloadLogs: () => {},
  filterLevels: [],
  fontSize: 'default',
  forceEscape: false,
  hasUnescapedContent: false,
  listStyle: LogListStyle.InlineWithColumns,
  setDedupStrategy: () => {},
  setFilterLevels: () => {},
  setFontSize: () => {},
  setForceEscape: () => {},
  setListStyle: () => {},
  setLogListState: () => {},
  setPinnedLogs: () => {},
  setShowTime: () => {},
  setShowUniqueLabels: () => {},
  setSortOrder: () => {},
  setSyntaxHighlighting: () => {},
  setTimestampResolution: () => {},
  showTime: true,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: true,
  timestampResolution: 'ns',
  isAssistantAvailable: false,
  openAssistantByLog: () => {},
  controlsExpanded: false,
  setControlsExpanded: () => {},
});

export const useLogListContextData = (key: keyof LogListContextData) => {
  const data: LogListContextData = useContext(LogListContext);
  return data[key];
};

export const useLogListContext = (): LogListContextData => {
  return useContext(LogListContext);
};

export const useLogIsPinned = (log: LogListModel) => {
  const { pinnedLogs } = useContext(LogListContext);
  return pinnedLogs?.some((logId) => logId === log.rowId);
};

export const useLogIsPermalinked = (log: LogListModel) => {
  const { permalinkedLogId } = useContext(LogListContext);
  return permalinkedLogId && permalinkedLogId === log.uid;
};

export const defaultValue: LogListContextData = {
  setDedupStrategy: jest.fn(),
  setFilterLevels: jest.fn(),
  setFontSize: jest.fn(),
  setForceEscape: jest.fn(),
  setListStyle: jest.fn(),
  setLogListState: jest.fn(),
  setPinnedLogs: jest.fn(),
  setShowTime: jest.fn(),
  setShowUniqueLabels: jest.fn(),
  setSortOrder: jest.fn(),
  setSyntaxHighlighting: jest.fn(),
  setTimestampResolution: jest.fn(),
  downloadLogs: jest.fn(),
  filterLevels: [],
  fontSize: 'default',
  forceEscape: false,
  hasUnescapedContent: false,
  app: CoreApp.Explore,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  isAssistantAvailable: false,
  openAssistantByLog: jest.fn(),
  timestampResolution: 'ns',
  controlsExpanded: false,
  setControlsExpanded: jest.fn(),
  listStyle: LogListStyle.InlineWithColumns,
};

export const defaultProps: Props = {
  app: CoreApp.Explore,
  containerElement: document.createElement('div'),
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  filterLevels: [],
  fontSize: 'default',
  getRowContextQuery: jest.fn(),
  listStyle: LogListStyle.Wrapped,
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
  timestampResolution: 'ms',
};

export const LogListContextProvider = ({
  app = CoreApp.Explore,
  children,
  dedupStrategy = LogsDedupStrategy.none,
  displayedFields = [],
  filterLevels = [],
  getRowContextQuery = jest.fn(),
  listStyle = LogListStyle.Wrapped,
  logLineMenuCustomItems = undefined,
  logs = [],
  logSupportsContext = jest.fn(),
  onLogLineHover,
  onPermalinkClick = jest.fn(),
  onPinLine = jest.fn(),
  onOpenContext = jest.fn(),
  onUnpinLine = jest.fn(),
  permalinkedLogId,
  pinnedLogs = [],
  showTime = true,
  sortOrder = LogsSortOrder.Descending,
  syntaxHighlighting = true,
  timestampResolution = 'ms',
}: Partial<Props>) => {
  const hasLogsWithErrors = logs.some((log) => !!checkLogsError(log));
  const hasSampledLogs = logs.some((log) => !!checkLogsSampled(log));

  return (
    <LogListContext.Provider
      value={{
        ...defaultValue,
        app,
        dedupStrategy,
        displayedFields,
        downloadLogs: jest.fn(),
        hasLogsWithErrors,
        hasSampledLogs,
        filterLevels,
        getRowContextQuery,
        listStyle,
        logLineMenuCustomItems,
        logSupportsContext,
        onLogLineHover,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        permalinkedLogId,
        pinnedLogs,
        setDedupStrategy: jest.fn(),
        setFilterLevels: jest.fn(),
        setFontSize: jest.fn(),
        setForceEscape: jest.fn(),
        setListStyle: jest.fn(),
        setLogListState: jest.fn(),
        setPinnedLogs: jest.fn(),
        setShowTime: jest.fn(),
        setShowUniqueLabels: jest.fn(),
        setSortOrder: jest.fn(),
        setSyntaxHighlighting: jest.fn(),
        showTime,
        sortOrder,
        syntaxHighlighting,
        timestampResolution,
      }}
    >
      {children}
    </LogListContext.Provider>
  );
};
