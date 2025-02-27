import { createContext, useContext } from 'react';

import { LogRowModel } from '@grafana/data';
import { PopoverContent } from '@grafana/ui';

import { GetRowContextQueryFn } from './LogLineMenu';

export interface LogListContextData {
  getRowContextQuery?: GetRowContextQueryFn;
  logSupportsContext?: (row: LogRowModel) => boolean;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
}

export const LogListContext = createContext<LogListContextData>({});

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
