import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { CoreApp, LogLevel, LogRowModel, LogsDedupStrategy, LogsSortOrder, shallowCompare, store } from '@grafana/data';
import { PopoverContent } from '@grafana/ui';

import { GetRowContextQueryFn } from './LogLineMenu';

export interface LogListContextData extends Omit<Props, 'showControls'> {
  filterLevels: LogLevel[];
  setDedupStrategy: (dedupStrategy: LogsDedupStrategy) => void;
  setDisplayedFields: (displayedFields: string[]) => void;
  setFilterLevels: (filterLevels: LogLevel[]) => void;
  setLogListState: Dispatch<SetStateAction<LogListState>>;
  setPinnedLogs: (pinnedlogs: string[]) => void;
  setSyntaxHighlighting: (syntaxHighlighting: boolean) => void;
  setShowTime: (showTime: boolean) => void;
  setSortOrder: (sortOrder: LogsSortOrder) => void;
  setWrapLogMessage: (showTime: boolean) => void;
}

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

export type LogListState = Pick<
  LogListContextData,
  | 'dedupStrategy'
  | 'displayedFields'
  | 'filterLevels'
  | 'pinnedLogs'
  | 'showTime'
  | 'sortOrder'
  | 'syntaxHighlighting'
  | 'wrapLogMessage'
>;

export interface Props {
  app: CoreApp;
  children?: ReactNode;
  dedupStrategy: LogsDedupStrategy;
  displayedFields: string[];
  filterLevels?: LogLevel[];
  getRowContextQuery?: GetRowContextQueryFn;
  logOptionsStorageKey?: string;
  logSupportsContext?: (row: LogRowModel) => boolean;
  onLogOptionsChange?: (option: keyof LogListState, value: string | boolean | string[]) => void;
  onLogLineHover?: (row?: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  showControls: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  syntaxHighlighting?: boolean;
  wrapLogMessage: boolean;
}

export const LogListContextProvider = ({
  app,
  children,
  dedupStrategy,
  displayedFields,
  getRowContextQuery,
  logOptionsStorageKey,
  filterLevels,
  logSupportsContext,
  onLogOptionsChange,
  onLogLineHover,
  onPermalinkClick,
  onPinLine,
  onOpenContext,
  onUnpinLine,
  pinLineButtonTooltipTitle,
  pinnedLogs,
  showControls,
  showTime,
  sortOrder,
  syntaxHighlighting = logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.syntaxHighlighting`, true) : true,
  wrapLogMessage,
}: Props) => {
  const [logListState, setLogListState] = useState<LogListState>({
    dedupStrategy,
    displayedFields,
    filterLevels:
      filterLevels ?? (logOptionsStorageKey ? store.getObject(`${logOptionsStorageKey}.filterLevels`, []) : []),
    pinnedLogs,
    showTime,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  });

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
    if (!shallowCompare(logListState.displayedFields, displayedFields)) {
      newState.displayedFields = displayedFields;
    }
    if (!shallowCompare(logListState.pinnedLogs ?? [], pinnedLogs ?? [])) {
      newState.pinnedLogs = pinnedLogs;
    }
    if (!shallowCompare(logListState, newState)) {
      setLogListState(newState);
    }
  }, [
    app,
    dedupStrategy,
    displayedFields,
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

  const setDedupStrategy = useCallback(
    (dedupStrategy: LogsDedupStrategy) => {
      setLogListState({ ...logListState, dedupStrategy });
      onLogOptionsChange?.('dedupStrategy', dedupStrategy);
    },
    [logListState, onLogOptionsChange]
  );

  const setDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      setLogListState({ ...logListState, displayedFields });
      onLogOptionsChange?.('displayedFields', displayedFields);
    },
    [logListState, onLogOptionsChange]
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

  return (
    <LogListContext.Provider
      value={{
        app,
        dedupStrategy: logListState.dedupStrategy,
        displayedFields: logListState.displayedFields,
        filterLevels: logListState.filterLevels,
        getRowContextQuery,
        logSupportsContext,
        onLogLineHover,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        pinLineButtonTooltipTitle,
        pinnedLogs: logListState.pinnedLogs,
        setDedupStrategy,
        setDisplayedFields,
        setFilterLevels,
        setLogListState,
        setPinnedLogs,
        setShowTime,
        setSortOrder,
        setSyntaxHighlighting,
        setWrapLogMessage,
        showTime: logListState.showTime,
        sortOrder: logListState.sortOrder,
        syntaxHighlighting: logListState.syntaxHighlighting,
        wrapLogMessage: logListState.wrapLogMessage,
      }}
    >
      {children}
    </LogListContext.Provider>
  );
};
