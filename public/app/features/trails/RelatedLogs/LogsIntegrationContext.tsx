import { createContext, PropsWithChildren, useEffect, useState } from 'react';

import {
  ExtractedRecordingRules,
  fetchAndExtractLokiRecordingRules,
  FoundLokiDataSource,
  getLogsUidOfMetric,
  getLogsQueryForMetric,
} from '../Integrations/logsIntegration';

export type LogsIntegrationContextValue = {
  findLogsDsForSelectedMetric: (metricName: string) => FoundLokiDataSource[];
  getLokiQueryForMetric: (metricName: string, dataSourceId: string) => string;
};
export const LogsIntegrationContext = createContext<LogsIntegrationContextValue>({
  findLogsDsForSelectedMetric: (metricName: string): FoundLokiDataSource[] => [],
  getLokiQueryForMetric: (metricName: string, dataSourceId: string): string => '',
});

export const LogsIntegrationContextProvider = ({ children }: PropsWithChildren) => {
  const [extractedLokiRules, setExtractedLokiRules] = useState<ExtractedRecordingRules>({});

  useEffect(() => {
    async function startLogsIntegration() {
      const rules = await fetchAndExtractLokiRecordingRules();
      setExtractedLokiRules(rules);
    }

    startLogsIntegration();
  }, []);

  const findLogsDsForSelectedMetric = (metricName: string): FoundLokiDataSource[] => {
    if (metricName === '') {
      return [];
    }

    return getLogsUidOfMetric(metricName, extractedLokiRules);
  };

  const getLokiQueryForMetric = (metricName: string, dataSourceId: string): string => {
    return getLogsQueryForMetric(metricName, dataSourceId, extractedLokiRules);
  };

  return (
    <LogsIntegrationContext.Provider value={{ findLogsDsForSelectedMetric, getLokiQueryForMetric }}>
      {children}
    </LogsIntegrationContext.Provider>
  );
};
