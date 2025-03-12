import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useState } from 'react';

import { CoreApp, LogRowModel } from '@grafana/data';
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
  setLogListState: Dispatch<SetStateAction<LogListState>>;
  showTime: boolean;
  wrapLogMessage: boolean;
}

export const LogListContext = createContext<LogListContextData>({
  app: CoreApp.Unknown,
  displayedFields: [],
  setLogListState: () => {},
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

export const setDisplayedFields = (displayedFields: string[]) => {
  const { setLogListState, ...rest } = useContext(LogListContext);
  setLogListState({ ...rest, displayedFields });
};

export const setPinnedLogs = (pinnedLogs: string[]) => {
  const { setLogListState, ...rest } = useContext(LogListContext);
  setLogListState({ ...rest, pinnedLogs });
};

export const setShowTime = (showTime: boolean) => {
  const { setLogListState, ...rest } = useContext(LogListContext);
  setLogListState({ ...rest, showTime });
};

export const setWrapLogMessage = (wrapLogMessage: boolean) => {
  const { setLogListState, ...rest } = useContext(LogListContext);
  setLogListState({ ...rest, wrapLogMessage });
};

type LogListState = Pick<LogListContextData, 'displayedFields' | 'pinnedLogs' | 'showTime' | 'wrapLogMessage'>;
export const LogListContextProvider = (props: LogListContextData) => {
  const [logListState, setLogListState] = useState<LogListState>({
    displayedFields: props.displayedFields,
    pinnedLogs: props.pinnedLogs,
    showTime: props.showTime,
    wrapLogMessage: props.wrapLogMessage,
  });
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
        setLogListState,
        showTime: logListState.showTime,
        wrapLogMessage: logListState.wrapLogMessage,
      }}
    >
      {props.children}
    </LogListContext.Provider>
  );
};
