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

import { createAssistantContextItem, OpenAssistantProps, useAssistant } from '@grafana/assistant';
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
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { PopoverContent } from '@grafana/ui';

import { checkLogsError, checkLogsSampled, downloadLogs as download, DownloadFormat } from '../../utils';
import { getDisplayedFieldsForLogs } from '../otel/formats';

import { LogLineTimestampResolution } from './LogLine';
import { LogLineDetailsMode } from './LogLineDetails';
import { GetRowContextQueryFn, LogLineMenuCustomItem } from './LogLineMenu';
import { LogListControlOptions, LogListFontSize } from './LogList';
import { reportInteractionOnce } from './analytics';
import { LogListModel } from './processing';
import { getScrollbarWidth, LOG_LIST_CONTROLS_WIDTH, LOG_LIST_MIN_WIDTH } from './virtualization';

export interface LogListContextData extends Omit<Props, 'containerElement' | 'logs' | 'logsMeta' | 'showControls'> {
  closeDetails: () => void;
  detailsDisplayed: (log: LogListModel) => boolean;
  detailsMode: LogLineDetailsMode;
  detailsWidth: number;
  downloadLogs: (format: DownloadFormat) => void;
  enableLogDetails: boolean;
  filterLevels: LogLevel[];
  forceEscape: boolean;
  hasLogsWithErrors?: boolean;
  hasSampledLogs?: boolean;
  hasUnescapedContent: boolean;
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
  setDedupStrategy: (dedupStrategy: LogsDedupStrategy) => void;
  setDetailsMode: (mode: LogLineDetailsMode) => void;
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
  setTimestampResolution: (format: LogLineTimestampResolution) => void;
  setWrapLogMessage: (showTime: boolean) => void;
  showDetails: LogListModel[];
  timestampResolution: LogLineTimestampResolution;
  toggleDetails: (log: LogListModel) => void;
  isAssistantAvailable: boolean;
  openAssistantByLog: ((log: LogListModel) => void) | undefined;
}

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  closeDetails: () => {},
  dedupStrategy: LogsDedupStrategy.none,
  detailsDisplayed: () => false,
  detailsMode: 'sidebar',
  detailsWidth: 0,
  displayedFields: [],
  downloadLogs: () => {},
  enableLogDetails: false,
  filterLevels: [],
  forceEscape: false,
  fontSize: 'default',
  hasUnescapedContent: false,
  noInteractions: false,
  setDedupStrategy: () => {},
  setDetailsMode: () => {},
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
  setTimestampResolution: () => {},
  setWrapLogMessage: () => {},
  showDetails: [],
  showTime: true,
  sortOrder: LogsSortOrder.Ascending,
  syntaxHighlighting: true,
  timestampResolution: 'ns',
  toggleDetails: () => {},
  wrapLogMessage: false,
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

export type LogListState = Pick<
  LogListContextData,
  | 'dedupStrategy'
  | 'fontSize'
  | 'forceEscape'
  | 'filterLevels'
  | 'pinnedLogs'
  | 'showUniqueLabels'
  | 'showTime'
  | 'sortOrder'
  | 'syntaxHighlighting'
  | 'timestampResolution'
>;

export type LogListOption = keyof LogListState | 'wrapLogMessage' | 'prettifyJSON';

export interface Props {
  app: CoreApp;
  children?: ReactNode;
  // Only ControlledLogRows can send an undefined containerElement. See LogList.tsx
  containerElement?: HTMLDivElement;
  detailsMode?: LogLineDetailsMode;
  dedupStrategy: LogsDedupStrategy;
  displayedFields: string[];
  enableLogDetails: boolean;
  filterLevels?: LogLevel[];
  fontSize: LogListFontSize;
  getRowContextQuery?: GetRowContextQueryFn;
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  logs: LogRowModel[];
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
  logsMeta?: LogsMetaItem[];
  logOptionsStorageKey?: string;
  logSupportsContext?: (row: LogRowModel) => boolean;
  noInteractions?: boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  onLogOptionsChange?: (option: LogListControlOptions, value: string | boolean | string[]) => void;
  onLogLineHover?: (row?: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  permalinkedLogId?: string;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  prettifyJSON?: boolean;
  setDisplayedFields?: (displayedFields: string[]) => void;
  showControls: boolean;
  showUniqueLabels?: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  syntaxHighlighting?: boolean;
  timestampResolution?: LogLineTimestampResolution;
  wrapLogMessage: boolean;
}

export const LogListContextProvider = ({
  app,
  children,
  containerElement,
  enableLogDetails,
  detailsMode: detailsModeProp,
  dedupStrategy,
  displayedFields,
  filterLevels,
  fontSize,
  isLabelFilterActive,
  getRowContextQuery,
  logs,
  logLineMenuCustomItems,
  logsMeta,
  logOptionsStorageKey,
  logSupportsContext,
  noInteractions,
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
  prettifyJSON: prettifyJSONProp = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.prettifyLogMessage`, true)
    : true,
  setDisplayedFields,
  showControls,
  showTime,
  showUniqueLabels,
  sortOrder,
  syntaxHighlighting,
  timestampResolution = logOptionsStorageKey
    ? (store.get(`${logOptionsStorageKey}.timestampResolution`) ?? 'ms')
    : 'ms',
  wrapLogMessage: wrapLogMessageProp,
}: Props) => {
  const [logListState, setLogListState] = useState<LogListState>({
    dedupStrategy,
    filterLevels:
      filterLevels ?? (logOptionsStorageKey ? store.getObject(`${logOptionsStorageKey}.filterLevels`, []) : []),
    fontSize,
    forceEscape: logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.forceEscape`, false) : false,
    pinnedLogs,
    showTime,
    showUniqueLabels,
    sortOrder,
    syntaxHighlighting,
    timestampResolution,
  });
  const [showDetails, setShowDetails] = useState<LogListModel[]>([]);
  const [detailsWidth, setDetailsWidthState] = useState(
    getDetailsWidth(containerElement, logOptionsStorageKey, undefined, detailsModeProp, showControls)
  );
  const [detailsMode, setDetailsMode] = useState<LogLineDetailsMode>(detailsModeProp ?? 'sidebar');
  const [isAssistantAvailable, openAssistant] = useAssistant();
  const [prettifyJSON, setPrettifyJSONState] = useState(prettifyJSONProp);
  const [wrapLogMessage, setWrapLogMessageState] = useState(wrapLogMessageProp);

  useEffect(() => {
    if (noInteractions) {
      return;
    }
    reportInteractionOnce(`logs_log_list_${app}_logs_displayed`, {
      dedupStrategy,
      fontSize,
      forceEscape: logListState.forceEscape,
      showTime,
      syntaxHighlighting,
      wrapLogMessage,
      detailsWidth,
      detailsMode,
      withDisplayedFields: displayedFields.length > 0,
      timestampResolution: logListState.timestampResolution,
    });
    // Just once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OTel displayed fields
  useEffect(() => {
    if (displayedFields.length > 0 || !config.featureToggles.otelLogsFormatting || !setDisplayedFields) {
      return;
    }
    const otelDisplayedFields = getDisplayedFieldsForLogs(logs);
    if (otelDisplayedFields.length) {
      setDisplayedFields(otelDisplayedFields);
    }
  }, [displayedFields.length, logs, setDisplayedFields]);

  // Sync state
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

  // Sync filter levels
  useEffect(() => {
    if (filterLevels === undefined) {
      return;
    }
    setLogListState((logListState) => {
      if (!shallowCompare(logListState.filterLevels, filterLevels)) {
        return { ...logListState, filterLevels };
      }
      return logListState;
    });
  }, [filterLevels]);

  // Sync font size
  useEffect(() => {
    setLogListState((logListState) => ({ ...logListState, fontSize }));
  }, [fontSize]);

  // Sync pinned logs
  useEffect(() => {
    if (!shallowCompare(logListState.pinnedLogs ?? [], pinnedLogs ?? [])) {
      setLogListState({ ...logListState, pinnedLogs });
    }
  }, [logListState, pinnedLogs]);

  // Sync show details
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

  // Sync log details inline and sidebar width
  useEffect(() => {
    setDetailsWidthState(getDetailsWidth(containerElement, logOptionsStorageKey, undefined, detailsMode, showControls));
  }, [containerElement, detailsMode, logOptionsStorageKey, showControls]);

  // Sync log details width
  useEffect(() => {
    if (!containerElement) {
      return;
    }
    const handleResize = debounce(() => {
      setDetailsWidthState((detailsWidth) =>
        getDetailsWidth(containerElement, logOptionsStorageKey, detailsWidth, detailsMode, showControls)
      );
    }, 50);
    const observer = new ResizeObserver(() => handleResize());
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, [containerElement, detailsMode, logOptionsStorageKey, showControls]);

  // Sync timestamp resolution
  useEffect(() => {
    setLogListState((state) => ({
      ...state,
      timestampResolution,
    }));
  }, [timestampResolution]);

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
      onLogOptionsChange?.('fontSize', fontSize);
    },
    [logOptionsStorageKey, onLogOptionsChange]
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
      const newTimestampFormat = showTime === false ? 'ms' : logListState.timestampResolution;
      setLogListState({
        ...logListState,
        showTime,
        timestampResolution: newTimestampFormat,
      });
      onLogOptionsChange?.('showTime', showTime);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.showTime`, showTime);
        store.set(`${logOptionsStorageKey}.timestampResolution`, newTimestampFormat);
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
      setPrettifyJSONState(prettifyJSON);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.prettifyLogMessage`, prettifyJSON);
      }
      onLogOptionsChange?.('prettifyJSON', prettifyJSON);
    },
    [logOptionsStorageKey, onLogOptionsChange]
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
      setWrapLogMessageState(wrapLogMessage);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.wrapLogMessage`, wrapLogMessage);
      }
      onLogOptionsChange?.('wrapLogMessage', wrapLogMessage);
    },
    [logOptionsStorageKey, onLogOptionsChange]
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
    showDetails.forEach((log) => removeDetailsScrollPosition(log));
    setShowDetails([]);
  }, [showDetails]);

  const toggleDetails = useCallback(
    (log: LogListModel) => {
      if (!enableLogDetails) {
        return;
      }
      const found = showDetails.find((stateLog) => stateLog === log || stateLog.uid === log.uid);
      if (found) {
        removeDetailsScrollPosition(found);
        setShowDetails(showDetails.filter((stateLog) => stateLog !== log && stateLog.uid !== log.uid));
      } else {
        // Supporting one displayed details for now
        setShowDetails([...showDetails, log]);
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

  const setTimestampResolution = useCallback(
    (timestampResolution: LogLineTimestampResolution) => {
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.timestampResolution`, timestampResolution);
      }
      setLogListState((state) => ({
        ...state,
        timestampResolution,
      }));
    },
    [logOptionsStorageKey]
  );

  const openAssistantByLog = useCallback(
    (log: LogListModel) => {
      if (!openAssistant) {
        return;
      }
      handleOpenAssistant(openAssistant, log);
    },
    [openAssistant]
  );

  const hasLogsWithErrors = useMemo(() => logs.some((log) => !!checkLogsError(log)), [logs]);
  const hasSampledLogs = useMemo(() => logs.some((log) => !!checkLogsSampled(log)), [logs]);
  const hasUnescapedContent = useMemo(() => logs.some((r) => r.hasUnescapedContent), [logs]);

  return (
    <LogListContext.Provider
      value={{
        app,
        closeDetails,
        detailsDisplayed,
        dedupStrategy: logListState.dedupStrategy,
        detailsMode,
        detailsWidth,
        displayedFields,
        downloadLogs,
        enableLogDetails,
        filterLevels: logListState.filterLevels,
        fontSize: logListState.fontSize,
        forceEscape: logListState.forceEscape,
        hasLogsWithErrors,
        hasSampledLogs,
        hasUnescapedContent,
        isLabelFilterActive,
        getRowContextQuery,
        logSupportsContext,
        logLineMenuCustomItems,
        logOptionsStorageKey,
        noInteractions: noInteractions ?? false,
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
        prettifyJSON,
        setDedupStrategy,
        setDetailsMode,
        setDetailsWidth,
        setDisplayedFields,
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
        setTimestampResolution,
        setWrapLogMessage,
        showDetails,
        showTime: logListState.showTime,
        showUniqueLabels: logListState.showUniqueLabels,
        sortOrder: logListState.sortOrder,
        syntaxHighlighting: logListState.syntaxHighlighting,
        timestampResolution: logListState.timestampResolution,
        toggleDetails,
        wrapLogMessage,
        isAssistantAvailable,
        openAssistantByLog,
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
  currentWidth?: number,
  detailsMode: LogLineDetailsMode = 'sidebar',
  showControls?: boolean
) {
  if (!containerElement) {
    return 0;
  }
  if (detailsMode === 'inline') {
    return containerElement.clientWidth - getScrollbarWidth() - (showControls ? LOG_LIST_CONTROLS_WIDTH : 0);
  }
  const defaultWidth = containerElement.clientWidth * 0.4;
  const detailsWidth =
    currentWidth ||
    (logOptionsStorageKey
      ? parseInt(store.get(`${logOptionsStorageKey}.detailsWidth`) ?? defaultWidth, 10)
      : defaultWidth);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

  // The user might have resized the screen.
  if (detailsWidth >= containerElement.clientWidth || detailsWidth > maxWidth) {
    return currentWidth ?? defaultWidth;
  }
  return detailsWidth;
}

const detailsScrollMap = new Map<string, number>();

export function saveDetailsScrollPosition(log: LogListModel, position: number) {
  detailsScrollMap.set(log.uid, position);
}

export function getDetailsScrollPosition(log: LogListModel) {
  return detailsScrollMap.get(log.uid) ?? 0;
}

export function removeDetailsScrollPosition(log: LogListModel) {
  detailsScrollMap.delete(log.uid);
}

async function handleOpenAssistant(openAssistant: (props: OpenAssistantProps) => void, log: LogListModel) {
  const datasource = await getDataSourceSrv().get(log.datasourceUid);
  const context = [];
  if (datasource) {
    context.push(createAssistantContextItem('datasource', { datasourceUid: datasource.uid }));
  }
  openAssistant({
    prompt: `${t('logs.log-line-menu.log-line-explainer', 'Explain this log line in a concise way')}:
    
    \`\`\`
    ${log.entry.replaceAll('`', '\\`')}
    \`\`\`
    `,
    origin: 'explain-log-line',
    context: [
      ...context,
      createAssistantContextItem('structured', {
        title: t('logs.log-line-menu.log-line', 'Log line'),
        data: {
          labels: log.labels,
          value: log.entry,
          timestamp: log.timestamp,
        },
      }),
    ],
  });
}
