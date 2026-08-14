import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { store } from '@grafana/data';
import { type LogListModel } from 'app/features/logs/components/panel/processing';

export interface LogDetailsContextData {
  currentLog: LogListModel | undefined;
  closeDetails: () => void;
  detailsDisplayed: (rowIndex: number) => boolean;
  enableLogDetails: boolean;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  replaceDetails: (log: LogListModel) => void;
  setCurrentLog: (log: LogListModel) => void;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  showDetails: LogListModel[];
  toggleDetails: (log: number | LogListModel) => void;
}

export const emptyContextData: LogDetailsContextData = {
  currentLog: undefined,
  closeDetails: () => {},
  detailsDisplayed: () => false,
  enableLogDetails: false,
  logs: [],
  prettifyDetailsJSON: true,
  replaceDetails: () => {},
  setCurrentLog: () => {},
  setPrettifyDetailsJSON: () => {},
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
  logOptionsStorageKey?: string;
  prettifyDetailsJSON?: boolean;
}

export const LogDetailsContextProvider = ({
  children,
  enableLogDetails,
  logs,
  logOptionsStorageKey,
  prettifyDetailsJSON: prettifyDetailsJSONProp,
}: Props) => {
  const [showDetails, setShowDetails] = useState<LogListModel[]>([]);
  const [currentLog, setCurrentLog] = useState<LogListModel | undefined>(undefined);
  const [prettifyDetailsJSON, setPrettifyDetailsJSONState] = useState(
    prettifyDetailsJSONProp ??
      (logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.prettifyDetailsJSON`, true) : true)
  );

  // Sync prettifyDetailsJSON
  useEffect(() => {
    if (prettifyDetailsJSONProp !== undefined) {
      setPrettifyDetailsJSONState(prettifyDetailsJSONProp);
    }
  }, [prettifyDetailsJSONProp]);

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
    (logRef: number | LogListModel) => {
      if (!enableLogDetails) {
        return;
      }
      const log = typeof logRef === 'number' ? logs.at(logRef) : logRef;
      if (!log) {
        console.error(`LogDetailsContext: undefined log with reference ${logRef}`);
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
        setShowDetails([...showDetails, log]);
        setCurrentLog(log);
      }
    },
    [currentLog, enableLogDetails, logs, showDetails]
  );

  const replaceDetails = useCallback(
    (log: LogListModel) => {
      if (!enableLogDetails || !currentLog) {
        return;
      }
      if (showDetails.find((stateLog) => stateLog.uid === log.uid)) {
        setCurrentLog(log);
        return;
      }
      const newShowDetails = showDetails.filter((stateLog) => stateLog.uid !== currentLog.uid);
      setShowDetails([...newShowDetails, log]);
      setCurrentLog(log);
    },
    [currentLog, enableLogDetails, showDetails]
  );

  const setPrettifyDetailsJSON = useCallback(
    (prettifyDetailsJSON: boolean) => {
      setPrettifyDetailsJSONState(prettifyDetailsJSON);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.prettifyDetailsJSON`, prettifyDetailsJSON);
      }
    },
    [logOptionsStorageKey]
  );

  return (
    <LogDetailsContext.Provider
      value={{
        closeDetails,
        currentLog,
        detailsDisplayed,
        enableLogDetails,
        logs,
        prettifyDetailsJSON,
        replaceDetails,
        setCurrentLog,
        setPrettifyDetailsJSON,
        showDetails,
        toggleDetails,
      }}
    >
      {children}
    </LogDetailsContext.Provider>
  );
};
