import { debounce } from 'lodash';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CoreApp,
  DataFrame,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsSortOrder,
  shallowCompare,
  store,
} from '@grafana/data';
import { PopoverContent } from '@grafana/ui';

import { DownloadFormat, checkLogsError, checkLogsSampled, downloadLogs as download } from '../../utils';

import { GetRowContextQueryFn, LogLineMenuCustomItem } from './LogLineMenu';
import { LogListFontSize } from './LogList';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

export interface LogListContextData extends Omit<Props, 'containerElement' | 'logs' | 'logsMeta' | 'showControls'> {
  closeDetails: () => void;
  detailsDisplayed: (log: LogListModel) => boolean;
  detailsWidth: number;
  downloadLogs: (format: DownloadFormat) => void;
  enableLogDetails: boolean;
  filterLevels: LogLevel[];
  hasLogsWithErrors?: boolean;
  hasSampledLogs?: boolean;
  hasUnescapedContent?: boolean;
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
  setDedupStrategy: (dedupStrategy: LogsDedupStrategy) => void;
  setDetailsWidth: (width: number) => void;
  setFilterLevels: (filterLevels: LogLevel[]) => void;
  setFontSize: (size: LogListFontSize) => void;
  setForceEscape: (forceEscape: boolean) => void;
  setLogListState: Dispatch<SetStateAction<LogListState>>;
  setPinnedLogs: (pinnedlogs: string[]) => void;
  setPrettifyJSON: (prettifyJSON: boolean) => void;
  setSyntaxHighlighting: (syntaxHighlighting: boolean) => void;
  setShowTime: (showTime: boolean) => void;
  setShowUniqueLabels: (showUniqueLabels: boolean) => void;
  setSortOrder: (sortOrder: LogsSortOrder) => void;
  setWrapLogMessage: (showTime: boolean) => void;
  showDetails: LogListModel[];
  toggleDetails: (log: LogListModel) => void;
}

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

export const useLogIsPinned = (log: LogListModel) => {
  const { pinnedLogs } = useContext(LogListContext);
  return pinnedLogs?.some((logId) => logId === log.rowId);
};

export const useLogIsPermalinked = (log: LogListModel) => {
  const { permalinkedLogId } = useContext(LogListContext);
  return permalinkedLogId && permalinkedLogId === log.uid;
};

export type LogListState = Pick<
  LogListContextData,
  | 'dedupStrategy'
  | 'fontSize'
  | 'forceEscape'
  | 'filterLevels'
  | 'hasUnescapedContent'
  | 'pinnedLogs'
  | 'prettifyJSON'
  | 'showUniqueLabels'
  | 'showTime'
  | 'sortOrder'
  | 'syntaxHighlighting'
  | 'wrapLogMessage'
>;

export interface Props {
  app: CoreApp;
  children?: ReactNode;
  // Only ControlledLogRows can send an undefined containerElement. See LogList.tsx
  containerElement?: HTMLDivElement;
  dedupStrategy: LogsDedupStrategy;
  displayedFields: string[];
  enableLogDetails: boolean;
  filterLevels?: LogLevel[];
  fontSize: LogListFontSize;
  forceEscape?: boolean;
  hasUnescapedContent?: boolean;
  getRowContextQuery?: GetRowContextQueryFn;
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  logs: LogRowModel[];
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
  logsMeta?: LogsMetaItem[];
  logOptionsStorageKey?: string;
  logSupportsContext?: (row: LogRowModel) => boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  onLogOptionsChange?: (option: keyof LogListState, value: string | boolean | string[]) => void;
  onLogLineHover?: (row?: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  permalinkedLogId?: string;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  prettifyJSON?: boolean;
  showControls: boolean;
  showUniqueLabels?: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  syntaxHighlighting?: boolean;
  wrapLogMessage: boolean;
}

export const LogListContextProvider = ({
  app,
  children,
  containerElement,
  enableLogDetails,
  dedupStrategy,
  displayedFields,
  filterLevels,
  fontSize,
  forceEscape = false,
  hasUnescapedContent,
  isLabelFilterActive,
  getRowContextQuery,
  logs,
  logLineMenuCustomItems,
  logsMeta,
  logOptionsStorageKey,
  logSupportsContext,
  onClickFilterLabel,
  onClickFilterOutLabel,
  onClickFilterString,
  onClickFilterOutString,
  onClickShowField,
  onClickHideField,
  onLogOptionsChange,
  onLogLineHover,
  onPermalinkClick,
  onPinLine,
  onOpenContext,
  onUnpinLine,
  permalinkedLogId,
  pinLineButtonTooltipTitle,
  pinnedLogs,
  prettifyJSON,
  showControls,
  showTime,
  showUniqueLabels,
  sortOrder,
  syntaxHighlighting,
  wrapLogMessage,
}: Props) => {
  const [logListState, setLogListState] = useState<LogListState>({
    dedupStrategy,
    filterLevels:
      filterLevels ?? (logOptionsStorageKey ? store.getObject(`${logOptionsStorageKey}.filterLevels`, []) : []),
    fontSize,
    forceEscape,
    hasUnescapedContent,
    pinnedLogs,
    prettifyJSON,
    showTime,
    showUniqueLabels,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  });
  const [showDetails, setShowDetails] = useState<LogListModel[]>([]);
  const [detailsWidth, setDetailsWidthState] = useState(getDetailsWidth(containerElement, logOptionsStorageKey));

  useEffect(() => {
    // Props are updated in the context only of the panel is being externally controlled.
    if (showControls && app !== CoreApp.PanelEditor) {
      return;
    }
    const newState = {
      ...logListState,
      dedupStrategy,
      showTime,
      sortOrder,
      syntaxHighlighting,
      wrapLogMessage,
    };
    if (!shallowCompare(logListState, newState)) {
      setLogListState(newState);
    }
  }, [
    app,
    dedupStrategy,
    logListState,
    pinnedLogs,
    showControls,
    showTime,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  ]);

  useEffect(() => {
    if (filterLevels === undefined) {
      return;
    }
    if (!shallowCompare(logListState.filterLevels, filterLevels)) {
      setLogListState({ ...logListState, filterLevels });
    }
  }, [filterLevels, logListState]);

  useEffect(() => {
    setLogListState((logListState) => ({ ...logListState, fontSize }));
  }, [fontSize]);

  useEffect(() => {
    if (logListState.hasUnescapedContent !== hasUnescapedContent) {
      setLogListState({ ...logListState, hasUnescapedContent });
    }
  }, [hasUnescapedContent, logListState]);

  useEffect(() => {
    if (!shallowCompare(logListState.pinnedLogs ?? [], pinnedLogs ?? [])) {
      setLogListState({ ...logListState, pinnedLogs });
    }
  }, [logListState, pinnedLogs]);

  useEffect(() => {
    if (!showDetails.length) {
      return;
    }
    const newShowDetails = showDetails.filter(
      (expandedLog) => logs.findIndex((log) => log.uid === expandedLog.uid) >= 0
    );
    if (newShowDetails.length !== showDetails.length) {
      setShowDetails(newShowDetails);
    }
  }, [logs, showDetails]);

  useEffect(() => {
    const handleResize = debounce(() => {
      setDetailsWidthState((detailsWidth) => getDetailsWidth(containerElement, logOptionsStorageKey, detailsWidth));
    }, 50);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [containerElement, logOptionsStorageKey]);

  const detailsDisplayed = useCallback(
    (log: LogListModel) => !!showDetails.find((shownLog) => shownLog.uid === log.uid),
    [showDetails]
  );

  const setDedupStrategy = useCallback(
    (dedupStrategy: LogsDedupStrategy) => {
      setLogListState({ ...logListState, dedupStrategy });
      onLogOptionsChange?.('dedupStrategy', dedupStrategy);
    },
    [logListState, onLogOptionsChange]
  );

  const setFontSize = useCallback(
    (fontSize: LogListFontSize) => {
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.fontSize`, fontSize);
      }
      setLogListState((logListState) => ({ ...logListState, fontSize }));
    },
    [logOptionsStorageKey]
  );

  const setForceEscape = useCallback(
    (forceEscape: boolean) => {
      setLogListState({ ...logListState, forceEscape });
    },
    [logListState]
  );

  const setFilterLevels = useCallback(
    (filterLevels: LogLevel[]) => {
      setLogListState({ ...logListState, filterLevels });
      onLogOptionsChange?.('filterLevels', filterLevels);
    },
    [logListState, onLogOptionsChange]
  );

  const setPinnedLogs = useCallback(
    (pinnedLogs: string[]) => {
      setLogListState({ ...logListState, pinnedLogs });
      onLogOptionsChange?.('pinnedLogs', pinnedLogs);
    },
    [logListState, onLogOptionsChange]
  );

  const setShowTime = useCallback(
    (showTime: boolean) => {
      setLogListState({ ...logListState, showTime });
      onLogOptionsChange?.('showTime', showTime);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.showTime`, showTime);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const setShowUniqueLabels = useCallback(
    (showUniqueLabels: boolean) => {
      setLogListState({ ...logListState, showUniqueLabels });
      onLogOptionsChange?.('showUniqueLabels', showUniqueLabels);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.showLabels`, showUniqueLabels);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const setPrettifyJSON = useCallback(
    (prettifyJSON: boolean) => {
      setLogListState({ ...logListState, prettifyJSON });
      onLogOptionsChange?.('prettifyJSON', prettifyJSON);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.prettifyLogMessage`, prettifyJSON);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const setSyntaxHighlighting = useCallback(
    (syntaxHighlighting: boolean) => {
      setLogListState({ ...logListState, syntaxHighlighting });
      onLogOptionsChange?.('syntaxHighlighting', syntaxHighlighting);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.syntaxHighlighting`, syntaxHighlighting);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const setSortOrder = useCallback(
    (sortOrder: LogsSortOrder) => {
      setLogListState({ ...logListState, sortOrder });
      onLogOptionsChange?.('sortOrder', sortOrder);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.sortOrder`, sortOrder);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const setWrapLogMessage = useCallback(
    (wrapLogMessage: boolean) => {
      setLogListState({ ...logListState, wrapLogMessage });
      onLogOptionsChange?.('wrapLogMessage', wrapLogMessage);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.wrapLogMessage`, wrapLogMessage);
      }
    },
    [logListState, logOptionsStorageKey, onLogOptionsChange]
  );

  const downloadLogs = useCallback(
    (format: DownloadFormat) => {
      const filteredLogs =
        logListState.filterLevels.length === 0
          ? logs
          : logs.filter((log) => logListState.filterLevels.includes(log.logLevel));
      download(format, filteredLogs, logsMeta);
    },
    [logListState.filterLevels, logs, logsMeta]
  );

  const closeDetails = useCallback(() => {
    setShowDetails([]);
  }, []);

  const toggleDetails = useCallback(
    (log: LogListModel) => {
      if (!enableLogDetails) {
        return;
      }
      const found = showDetails.findIndex((stateLog) => stateLog === log || stateLog.uid === log.uid);
      if (found >= 0) {
        setShowDetails(showDetails.filter((stateLog) => stateLog !== log && stateLog.uid !== log.uid));
      } else {
        // Supporting one displayed details for now
        setShowDetails([log]);
      }
    },
    [enableLogDetails, showDetails]
  );

  const setDetailsWidth = useCallback(
    (width: number) => {
      if (!logOptionsStorageKey || !containerElement) {
        return;
      }

      const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;
      if (width > maxWidth) {
        return;
      }

      store.set(`${logOptionsStorageKey}.detailsWidth`, width);
      setDetailsWidthState(width);
    },
    [containerElement, logOptionsStorageKey]
  );

  const hasLogsWithErrors = useMemo(() => logs.some((log) => !!checkLogsError(log)), [logs]);
  const hasSampledLogs = useMemo(() => logs.some((log) => !!checkLogsSampled(log)), [logs]);

  return (
    <LogListContext.Provider
      value={{
        app,
        closeDetails,
        detailsDisplayed,
        dedupStrategy: logListState.dedupStrategy,
        detailsWidth,
        displayedFields,
        downloadLogs,
        enableLogDetails,
        filterLevels: logListState.filterLevels,
        fontSize: logListState.fontSize,
        forceEscape: logListState.forceEscape,
        hasLogsWithErrors,
        hasSampledLogs,
        hasUnescapedContent: logListState.hasUnescapedContent,
        isLabelFilterActive,
        getRowContextQuery,
        logSupportsContext,
        logLineMenuCustomItems,
        onClickFilterLabel,
        onClickFilterOutLabel,
        onClickFilterString,
        onClickFilterOutString,
        onClickShowField,
        onClickHideField,
        onLogLineHover,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        permalinkedLogId,
        pinLineButtonTooltipTitle,
        pinnedLogs: logListState.pinnedLogs,
        prettifyJSON: logListState.prettifyJSON,
        setDedupStrategy,
        setDetailsWidth,
        setFilterLevels,
        setFontSize,
        setForceEscape,
        setLogListState,
        setPinnedLogs,
        setPrettifyJSON,
        setShowTime,
        setShowUniqueLabels,
        setSortOrder,
        setSyntaxHighlighting,
        setWrapLogMessage,
        showDetails,
        showTime: logListState.showTime,
        showUniqueLabels: logListState.showUniqueLabels,
        sortOrder: logListState.sortOrder,
        syntaxHighlighting: logListState.syntaxHighlighting,
        toggleDetails,
        wrapLogMessage: logListState.wrapLogMessage,
      }}
    >
      {children}
    </LogListContext.Provider>
  );
};

export function isLogsSortOrder(value: unknown): value is LogsSortOrder {
  return value === LogsSortOrder.Ascending || value === LogsSortOrder.Descending;
}

export function isDedupStrategy(value: unknown): value is LogsDedupStrategy {
  return (
    value === LogsDedupStrategy.exact ||
    value === LogsDedupStrategy.none ||
    value === LogsDedupStrategy.numbers ||
    value === LogsDedupStrategy.signature
  );
}

// Only ControlledLogRows can send an undefined containerElement. See LogList.tsx
function getDetailsWidth(
  containerElement: HTMLDivElement | undefined,
  logOptionsStorageKey?: string,
  currentWidth?: number
) {
  if (!containerElement) {
    return 0;
  }
  const defaultWidth = containerElement.clientWidth * 0.4;
  const detailsWidth =
    currentWidth ||
    (logOptionsStorageKey ? parseInt(store.get(`${logOptionsStorageKey}.detailsWidth`), 10) : defaultWidth);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

  // The user might have resized the screen.
  if (detailsWidth >= containerElement.clientWidth || detailsWidth > maxWidth) {
    return currentWidth ?? defaultWidth;
  }
  return detailsWidth;
}
