import { debounce } from 'lodash';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { LogRowModel, store } from '@grafana/data';

import { LogLineDetailsMode } from './LogLineDetails';
import { LogListModel } from './processing';
import { getScrollbarWidth, LOG_LIST_CONTROLS_WIDTH, LOG_LIST_MIN_WIDTH } from './virtualization';

export interface LogDetailsContextData {
  closeDetails: () => void;
  detailsDisplayed: (log: LogListModel) => boolean;
  detailsMode: LogLineDetailsMode;
  detailsWidth: number;
  enableLogDetails: boolean;
  setDetailsMode: (mode: LogLineDetailsMode) => void;
  setDetailsWidth: (width: number) => void;
  showDetails: LogListModel[];
  toggleDetails: (log: LogListModel) => void;
}

export const LogDetailsContext = createContext<LogDetailsContextData>({
  closeDetails: () => {},
  detailsDisplayed: () => false,
  detailsMode: 'sidebar',
  detailsWidth: 0,
  enableLogDetails: false,
  setDetailsMode: () => {},
  setDetailsWidth: () => {},
  showDetails: [],
  toggleDetails: () => {},
});

export const useLogDetailsContextData = (key: keyof LogDetailsContextData) => {
  const data: LogDetailsContextData = useContext(LogDetailsContext);
  return data[key];
};

export const useLogDetailsContext = (): LogDetailsContextData => {
  return useContext(LogDetailsContext);
};

export interface Props {
  children?: ReactNode;
  // Only ControlledLogRows can send an undefined containerElement. See LogList.tsx
  containerElement?: HTMLDivElement;
  detailsMode?: LogLineDetailsMode;
  enableLogDetails: boolean;
  logs: LogRowModel[];
  logOptionsStorageKey?: string;
  showControls: boolean;
}

export const LogDetailsContextProvider = ({
  children,
  containerElement,
  enableLogDetails,
  logOptionsStorageKey,
  detailsMode: detailsModeProp = logOptionsStorageKey
    ? (store.get(`${logOptionsStorageKey}.detailsMode`) ?? getDefaultDetailsMode(containerElement))
    : getDefaultDetailsMode(containerElement),
  logs,
  showControls,
}: Props) => {
  const [showDetails, setShowDetails] = useState<LogListModel[]>([]);
  const [detailsWidth, setDetailsWidthState] = useState(
    getDetailsWidth(containerElement, logOptionsStorageKey, undefined, detailsModeProp, showControls)
  );
  const [detailsMode, setDetailsMode] = useState<LogLineDetailsMode>(
    detailsModeProp ?? getDefaultDetailsMode(containerElement)
  );

  // Sync details mode
  useEffect(() => {
    if (detailsModeProp) {
      setDetailsMode(detailsModeProp);
    }
  }, [detailsModeProp]);

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

  const detailsDisplayed = useCallback(
    (log: LogListModel) => !!showDetails.find((shownLog) => shownLog.uid === log.uid),
    [showDetails]
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

  return (
    <LogDetailsContext.Provider
      value={{
        closeDetails,
        detailsDisplayed,
        detailsMode,
        detailsWidth,
        enableLogDetails,
        setDetailsMode,
        setDetailsWidth,
        showDetails,
        toggleDetails,
      }}
    >
      {children}
    </LogDetailsContext.Provider>
  );
};

// Only ControlledLogRows can send an undefined containerElement. See LogList.tsx
export function getDetailsWidth(
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

export function getDefaultDetailsMode(container: HTMLDivElement | undefined): LogLineDetailsMode {
  const width = container?.clientWidth ?? window.innerWidth;
  return width > 1440 ? 'sidebar' : 'inline';
}
