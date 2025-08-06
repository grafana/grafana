import { createContext, useContext } from 'react';

import { CoreApp, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';
import { checkLogsError, checkLogsSampled } from 'app/features/logs/utils';

import { LogLineDetailsMode } from '../LogLineDetails';
import { LogListContextData, Props } from '../LogListContext';
import { LogListModel } from '../processing';

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue([true, jest.fn()]),
  };
});

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
  fontSize: 'default',
  forceEscape: false,
  hasUnescapedContent: false,
  setDedupStrategy: () => {},
  setDetailsWidth: () => {},
  setFilterLevels: () => {},
  setFontSize: () => {},
  setForceEscape: () => {},
  setLogListState: () => {},
  setPinnedLogs: () => {},
  setPrettifyJSON: () => {},
  setShowTime: () => {},
  setShowUniqueLabels: () => {},
  setSortOrder: () => {},
  setSyntaxHighlighting: () => {},
  setTimestampFormat: () => {},
  setWrapLogMessage: () => {},
  showDetails: [],
  showTime: true,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: true,
  timestampResolution: 'ns',
  toggleDetails: () => {},
  wrapLogMessage: false,
  detailsMode: 'sidebar',
  setDetailsMode: function (mode: LogLineDetailsMode): void {
    throw new Error('Function not implemented.');
  },
  isAssistantAvailable: false,
  openAssistantByLog: () => {},
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
  detailsMode: 'sidebar',
  setDetailsMode: jest.fn(),
  setDedupStrategy: jest.fn(),
  setFilterLevels: jest.fn(),
  setFontSize: jest.fn(),
  setForceEscape: jest.fn(),
  setLogListState: jest.fn(),
  setPinnedLogs: jest.fn(),
  setShowTime: jest.fn(),
  setShowUniqueLabels: jest.fn(),
  setSortOrder: jest.fn(),
  setPrettifyJSON: jest.fn(),
  setSyntaxHighlighting: jest.fn(),
  setTimestampFormat: jest.fn(),
  setWrapLogMessage: jest.fn(),
  closeDetails: jest.fn(),
  detailsDisplayed: jest.fn(),
  detailsWidth: 300,
  downloadLogs: jest.fn(),
  enableLogDetails: false,
  filterLevels: [],
  fontSize: 'default',
  forceEscape: false,
  hasUnescapedContent: false,
  setDetailsWidth: jest.fn(),
  showDetails: [],
  toggleDetails: jest.fn(),
  app: CoreApp.Explore,
  dedupStrategy: LogsDedupStrategy.exact,
  displayedFields: [],
  showTime: false,
  sortOrder: LogsSortOrder.Ascending,
  wrapLogMessage: false,
  isAssistantAvailable: false,
  openAssistantByLog: () => {},
  timestampResolution: 'ns',
};

export const defaultProps: Props = {
  app: CoreApp.Explore,
  containerElement: document.createElement('div'),
  dedupStrategy: LogsDedupStrategy.none,
  displayedFields: [],
  enableLogDetails: false,
  filterLevels: [],
  fontSize: 'default',
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
  timestampResolution: 'ms',
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
  showDetails = [],
  showTime = true,
  sortOrder = LogsSortOrder.Descending,
  syntaxHighlighting = true,
  timestampResolution = 'ms',
  wrapLogMessage = true,
}: Partial<Props> & { showDetails?: LogListModel[] }) => {
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
        enableLogDetails,
        hasLogsWithErrors,
        hasSampledLogs,
        filterLevels,
        getRowContextQuery,
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
        setLogListState: jest.fn(),
        setPinnedLogs: jest.fn(),
        setPrettifyJSON: jest.fn(),
        setShowTime: jest.fn(),
        setShowUniqueLabels: jest.fn(),
        setSortOrder: jest.fn(),
        setSyntaxHighlighting: jest.fn(),
        setWrapLogMessage: jest.fn(),
        showDetails,
        showTime,
        sortOrder,
        syntaxHighlighting,
        timestampResolution,
        wrapLogMessage,
      }}
    >
      {children}
    </LogListContext.Provider>
  );
};

export const saveDetailsScrollPosition = jest.fn();

export const getDetailsScrollPosition = jest.fn();

export const removeDetailsScrollPosition = jest.fn();
