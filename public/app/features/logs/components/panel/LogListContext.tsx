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

import { CoreApp, LogRowModel, LogsDedupStrategy, LogsSortOrder, shallowCompare } from '@grafana/data';
import { PopoverContent } from '@grafana/ui';

import { GetRowContextQueryFn } from './LogLineMenu';

export interface LogListContextData extends Props {
  setDedupStrategy: (dedupStrategy: LogsDedupStrategy) => void;
  setDisplayedFields: (displayedFields: string[]) => void;
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
  setDedupStrategy: () => {},
  setDisplayedFields: () => {},
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
  getRowContextQuery?: GetRowContextQueryFn;
  logSupportsContext?: (row: LogRowModel) => boolean;
  onLogOptionsChange?: (option: keyof LogListState, value: string | boolean | string[]) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  showTime: boolean;
  sortOrder: LogsSortOrder;
  syntaxHighlighting: boolean;
  wrapLogMessage: boolean;
}

export const LogListContextProvider = ({
  app,
  children,
  dedupStrategy,
  displayedFields,
  getRowContextQuery,
  logSupportsContext,
  onLogOptionsChange,
  onPermalinkClick,
  onPinLine,
  onOpenContext,
  onUnpinLine,
  pinLineButtonTooltipTitle,
  pinnedLogs,
  showTime,
  sortOrder,
  syntaxHighlighting,
  wrapLogMessage,
}: Props) => {
  const [logListState, setLogListState] = useState<LogListState>({
    dedupStrategy,
    displayedFields,
    pinnedLogs,
    showTime,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  });

  useEffect(() => {
    if (dedupStrategy !== logListState.dedupStrategy) {
      setLogListState({
        ...logListState,
        dedupStrategy: dedupStrategy,
      });
    }
  }, [logListState, dedupStrategy]);

  useEffect(() => {
    if (!shallowCompare(logListState.displayedFields, displayedFields)) {
      setLogListState({
        ...logListState,
        displayedFields: displayedFields,
      });
    }
  }, [logListState, displayedFields]);

  useEffect(() => {
    if (!shallowCompare(logListState.pinnedLogs ?? [], pinnedLogs ?? [])) {
      setLogListState({
        ...logListState,
        pinnedLogs: pinnedLogs,
      });
    }
  }, [logListState, pinnedLogs]);

  useEffect(() => {
    if (showTime !== logListState.showTime) {
      setLogListState({
        ...logListState,
        showTime: showTime,
      });
    }
  }, [logListState, showTime]);

  useEffect(() => {
    if (sortOrder !== logListState.sortOrder) {
      setLogListState({
        ...logListState,
        sortOrder: sortOrder,
      });
    }
  }, [logListState, sortOrder]);

  useEffect(() => {
    if (syntaxHighlighting !== logListState.syntaxHighlighting) {
      setLogListState({
        ...logListState,
        syntaxHighlighting: syntaxHighlighting,
      });
    }
  }, [logListState, syntaxHighlighting]);

  useEffect(() => {
    if (wrapLogMessage !== logListState.wrapLogMessage) {
      setLogListState({
        ...logListState,
        wrapLogMessage: wrapLogMessage,
      });
    }
  }, [logListState, wrapLogMessage]);

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
    },
    [logListState, onLogOptionsChange]
  );

  const setSyntaxHighlighting = useCallback(
    (syntaxHighlighting: boolean) => {
      setLogListState({ ...logListState, syntaxHighlighting });
      onLogOptionsChange?.('syntaxHighlighting', syntaxHighlighting);
    },
    [logListState, onLogOptionsChange]
  );

  const setSortOrder = useCallback(
    (sortOrder: LogsSortOrder) => {
      setLogListState({ ...logListState, sortOrder });
      onLogOptionsChange?.('sortOrder', sortOrder);
    },
    [logListState, onLogOptionsChange]
  );

  const setWrapLogMessage = useCallback(
    (wrapLogMessage: boolean) => {
      setLogListState({ ...logListState, wrapLogMessage });
      onLogOptionsChange?.('wrapLogMessage', wrapLogMessage);
    },
    [logListState, onLogOptionsChange]
  );

  return (
    <LogListContext.Provider
      value={{
        app,
        dedupStrategy: logListState.dedupStrategy,
        displayedFields: logListState.displayedFields,
        getRowContextQuery,
        logSupportsContext,
        onPermalinkClick,
        onPinLine,
        onOpenContext,
        onUnpinLine,
        pinLineButtonTooltipTitle,
        pinnedLogs: logListState.pinnedLogs,
        setDedupStrategy,
        setDisplayedFields,
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
