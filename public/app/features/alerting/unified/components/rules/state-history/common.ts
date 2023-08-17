import { cloneDeep, groupBy, isEqual, uniqBy } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { DataFrame, DataFrameJSON, PanelData } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { logInfo, LogMessages } from '../../../Analytics';
import { StateHistoryImplementation } from '../../../hooks/useStateHistoryModal';

import { isLine, isNumbers, logRecordsToDataFrameForPanel } from './useRuleHistoryRecords';

export interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values?: Record<string, number>;
  labels?: Record<string, string>;
}

export interface LogRecord {
  timestamp: number;
  line: Line;
}

export type Label = [string, string];

// omit "common" labels from "labels"
export function omitLabels(labels: Label[], common: Label[]): Label[] {
  return labels.filter((label) => {
    return !common.find((commonLabel) => JSON.stringify(commonLabel) === JSON.stringify(label));
  });
}

// find all common labels by looking at which ones occur in every record, then create a unique array of items for those
export function extractCommonLabels(labels: Label[][]): Label[] {
  const flatLabels = labels.flatMap((label) => label);

  const commonLabels = uniqBy(
    flatLabels.filter((label) => {
      const count = flatLabels.filter((l) => isEqual(label, l)).length;
      return count === Object.keys(labels).length;
    }),
    (label) => JSON.stringify(label)
  );

  return commonLabels;
}

export const getLogRecordsByInstances = (stateHistory?: DataFrameJSON) => {
  // merge timestamp with "line"
  const tsValues = stateHistory?.data?.values[0] ?? [];
  const timestamps: number[] = isNumbers(tsValues) ? tsValues : [];
  const lines = stateHistory?.data?.values[1] ?? [];

  const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
    const line = lines[index];
    // values property can be undefined for some instance states (e.g. NoData)
    if (isLine(line)) {
      acc.push({ timestamp, line });
    }

    return acc;
  }, []);

  // group all records by alert instance (unique set of labels)
  const logRecordsByInstance = groupBy(logRecords, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  return { logRecordsByInstance, logRecords };
};

export function getRuleHistoryRecordsForPanel(stateHistory?: DataFrameJSON) {
  if (!stateHistory) {
    return { dataFrames: [] };
  }
  const theme = config.theme2;

  const { logRecordsByInstance } = getLogRecordsByInstances(stateHistory);

  const groupedLines = Object.entries(logRecordsByInstance);

  const dataFrames: DataFrame[] = groupedLines.map<DataFrame>(([key, records]) => {
    return logRecordsToDataFrameForPanel(key, records, theme);
  });

  return {
    dataFrames,
  };
}

export const getHistoryImplementation = () => {
  // can be "loki", "multiple" or "annotations"
  const stateHistoryBackend = config.unifiedAlerting.alertStateHistoryBackend;
  // can be "loki" or "annotations"
  const stateHistoryPrimary = config.unifiedAlerting.alertStateHistoryPrimary;

  // if "loki" is either the backend or the primary, show the new state history implementation
  const usingNewAlertStateHistory = [stateHistoryBackend, stateHistoryPrimary].some(
    (implementation) => implementation === StateHistoryImplementation.Loki
  );
  const implementation = usingNewAlertStateHistory
    ? StateHistoryImplementation.Loki
    : StateHistoryImplementation.Annotations;
  return implementation;
};

export const updatePanelDataWithASHFromLoki = async (panelDataProcessed: PanelData) => {
  //--- check if alert state history uses Loki as implementation, if so, fetch data from Loki state history and concat it to annotations
  const historyImplementation = getHistoryImplementation();
  const usingLokiAsImplementation = historyImplementation === StateHistoryImplementation.Loki;

  const notShouldFetchLokiAsh =
    !usingLokiAsImplementation ||
    !panelDataProcessed.alertState?.dashboardId ||
    !panelDataProcessed.alertState?.panelId;

  if (notShouldFetchLokiAsh) {
    return panelDataProcessed;
  }

  try {
    // fetch data from Loki state history
    let annotationsWithHistory = await lastValueFrom(
      getBackendSrv().fetch<DataFrameJSON>({
        url: '/api/v1/rules/history',
        method: 'GET',
        params: {
          panelID: panelDataProcessed.request?.panelId,
          dashboardUID: panelDataProcessed.request?.dashboardUID,
          from: panelDataProcessed.timeRange.from.unix(),
          to: panelDataProcessed.timeRange.to.unix(),
          limit: 250,
        },
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    const records = getRuleHistoryRecordsForPanel(annotationsWithHistory.data);
    const clonedPanel = cloneDeep(panelDataProcessed);
    // annotations can be undefined
    clonedPanel.annotations = panelDataProcessed.annotations
      ? panelDataProcessed.annotations.concat(records.dataFrames)
      : panelDataProcessed.annotations;
    return clonedPanel;
  } catch (error) {
    logInfo(LogMessages.errorGettingLokiHistory, {
      error: error instanceof Error ? error.message : 'Unknown error getting Loki ash',
    });
    return panelDataProcessed;
  }
};
