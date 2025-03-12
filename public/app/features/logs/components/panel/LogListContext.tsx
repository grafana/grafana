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

import { CoreApp, LogRowModel, shallowCompare } from '@grafana/data';
import { PopoverContent } from '@grafana/ui';

import { GetRowContextQueryFn } from './LogLineMenu';

export interface LogListContextData {
  app: CoreApp;
  children?: ReactNode;
  displayedFields: string[];
  getRowContextQuery?: GetRowContextQueryFn;
  logSupportsContext?: (row: LogRowModel) => boolean;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  setDisplayedFields: (displayedFields: string[]) => void;
  setLogListState: Dispatch<SetStateAction<LogListState>>;
  setPinnedLogs: (pinnedlogs: string[]) => void;
  setShowTime: (showTime: boolean) => void;
  setWrapLogMessage: (showTime: boolean) => void;
  showTime: boolean;
  wrapLogMessage: boolean;
}

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  displayedFields: [],
  setDisplayedFields: () => {},
  setLogListState: () => {},
  setPinnedLogs: () => {},
  setShowTime: () => {},
  setWrapLogMessage: () => {},
  showTime: true,
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

type LogListState = Pick<LogListContextData, 'displayedFields' | 'pinnedLogs' | 'showTime' | 'wrapLogMessage'>;
export const LogListContextProvider = (props: LogListContextData) => {
  const [logListState, setLogListState] = useState<LogListState>({
    displayedFields: props.displayedFields,
    pinnedLogs: props.pinnedLogs,
    showTime: props.showTime,
    wrapLogMessage: props.wrapLogMessage,
  });

  useEffect(() => {
    if (!shallowCompare(logListState.displayedFields, props.displayedFields)) {
      setLogListState({
        ...logListState,
        displayedFields: props.displayedFields,
      });
    }
  }, [logListState, props.displayedFields]);

  useEffect(() => {
    if (!shallowCompare(logListState.pinnedLogs ?? [], props.pinnedLogs ?? [])) {
      setLogListState({
        ...logListState,
        pinnedLogs: props.pinnedLogs,
      });
    }
  }, [logListState, props.pinnedLogs]);

  const setDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      setLogListState({ ...logListState, displayedFields });
    },
    [logListState]
  );

  const setPinnedLogs = useCallback(
    (pinnedLogs: string[]) => {
      setLogListState({ ...logListState, pinnedLogs });
    },
    [logListState]
  );

  const setShowTime = useCallback(
    (showTime: boolean) => {
      setLogListState({ ...logListState, showTime });
    },
    [logListState]
  );

  const setWrapLogMessage = useCallback(
    (wrapLogMessage: boolean) => {
      setLogListState({ ...logListState, wrapLogMessage });
    },
    [logListState]
  );
  return (
    <LogListContext.Provider
      value={{
        app: props.app,
        displayedFields: logListState.displayedFields,
        getRowContextQuery: props.getRowContextQuery,
        logSupportsContext: props.logSupportsContext,
        onPermalinkClick: props.onPermalinkClick,
        onPinLine: props.onPinLine,
        onOpenContext: props.onOpenContext,
        onUnpinLine: props.onUnpinLine,
        pinLineButtonTooltipTitle: props.pinLineButtonTooltipTitle,
        pinnedLogs: logListState.pinnedLogs,
        setDisplayedFields,
        setLogListState,
        setPinnedLogs,
        setShowTime,
        setWrapLogMessage,
        showTime: logListState.showTime,
        wrapLogMessage: logListState.wrapLogMessage,
      }}
    >
      {props.children}
    </LogListContext.Provider>
  );
};
