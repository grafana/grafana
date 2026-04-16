import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { type LogListModel } from 'app/features/logs/components/panel/processing';

export interface LogDetailsContextData {
  currentLog: LogListModel | undefined;
  closeDetails: () => void;
  detailsDisplayed: (rowIndex: number) => boolean;
  enableLogDetails: boolean;
  logs: LogListModel[];
  showDetails: LogListModel[];
  toggleDetails: (rowIndex: number) => void;
}

export const emptyContextData: LogDetailsContextData = {
  currentLog: undefined,
  closeDetails: () => {},
  detailsDisplayed: () => false,
  enableLogDetails: false,
  logs: [],
  showDetails: [],
  toggleDetails: () => {},
};
export const LogDetailsContext = createContext<LogDetailsContextData>(emptyContextData);

export const useLogDetailsContextData = (key: keyof LogDetailsContextData) => {
  const data: LogDetailsContextData = useContext(LogDetailsContext);
  return data[key];
};

export const useLogDetailsContext = (): LogDetailsContextData => {
  return useContext(LogDetailsContext);
};

export interface Props {
  children?: ReactNode;
  enableLogDetails: boolean;
  logs: LogListModel[];
}

export const LogDetailsContextProvider = ({ children, enableLogDetails, logs }: Props) => {
  const [showDetails, setShowDetails] = useState<LogListModel[]>([]);
  const [currentLog, setCurrentLog] = useState<LogListModel | undefined>(undefined);

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

  const closeDetails = useCallback(() => {
    setShowDetails([]);
    setCurrentLog(undefined);
  }, []);

  const detailsDisplayed = useCallback(
    (rowIndex: number) => {
      const log = logs.at(rowIndex);
      if (!log) {
        return false;
      }
      return !!showDetails.find((shownLog) => shownLog.uid === log.uid);
    },
    [logs, showDetails]
  );

  const toggleDetails = useCallback(
    (rowIndex: number) => {
      if (!enableLogDetails) {
        return;
      }
      const log = logs.at(rowIndex);
      if (!log) {
        console.error(`LogDetailsContext: undefined log at rowIndex ${rowIndex}`);
        return;
      }
      const found = showDetails.find((stateLog) => stateLog.uid === log.uid);
      if (found) {
        const newShowDetails = showDetails.filter((stateLog) => stateLog.uid !== log.uid);
        setShowDetails(newShowDetails);
        if (currentLog && currentLog.uid === log.uid) {
          setCurrentLog(newShowDetails[newShowDetails.length - 1]);
        }
      } else {
        // Supporting one displayed details for now
        setShowDetails([...showDetails, log]);
        setCurrentLog(log);
      }
    },
    [currentLog, enableLogDetails, logs, showDetails]
  );

  return (
    <LogDetailsContext.Provider
      value={{
        closeDetails,
        currentLog,
        detailsDisplayed,
        enableLogDetails,
        logs,
        showDetails,
        toggleDetails,
      }}
    >
      {children}
    </LogDetailsContext.Provider>
  );
};
