import { createContext, PropsWithChildren, useEffect, useState } from 'react';

import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import {
  ExtractedRecordingRules,
  fetchAndExtractLokiRecordingRules,
  FoundLokiDataSource,
  getLogsUidOfMetric,
} from '../Integrations/logsIntegration';

export interface LogsIntegrationSceneState extends SceneObjectState {}

export class LogsIntegrationScene extends SceneObjectBase<LogsIntegrationSceneState> {
  constructor(state: Partial<LogsIntegrationSceneState>) {
    super(state);
  }
}

export type LogsIntegrationContextValue = {
  findLogsDsForSelectedMetric: (metricName: string) => FoundLokiDataSource[];
};
export const LogsIntegrationContext = createContext<LogsIntegrationContextValue>({
  findLogsDsForSelectedMetric: (metricName: string): FoundLokiDataSource[] => [],
});

export const LogsIntegrationContextProvider = ({ children }: PropsWithChildren) => {
  const [extractedLokiRules, setExtractedLokiRules] = useState<ExtractedRecordingRules>([]);

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

  return (
    <LogsIntegrationContext.Provider value={{ findLogsDsForSelectedMetric }}>
      {children}
    </LogsIntegrationContext.Provider>
  );
};
