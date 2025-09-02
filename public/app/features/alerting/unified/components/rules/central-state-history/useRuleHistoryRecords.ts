import { useMemo } from 'react';

import { DataFrameJSON } from '@grafana/data';
import { mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { labelsMatchMatchers } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { StateFilterValues } from './CentralAlertHistoryScene';

type StateFilter = (typeof StateFilterValues)[keyof typeof StateFilterValues];

const emptyFilters: HistoryRecordFilters = {
  labels: '',
  stateFrom: StateFilterValues.all,
  stateTo: StateFilterValues.all,
};

interface HistoryRecordFilters {
  labels: string;
  stateFrom?: StateFilter;
  stateTo?: StateFilter;
}

/**
 * This hook filters the history records based on the label, stateTo and stateFrom filters.
 * @param filterInLabel
 * @param filterInStateTo
 * @param filterInStateFrom
 * @param stateHistory the original history records
 * @returns the filtered history records
 */
export function useRuleHistoryRecords(stateHistory?: DataFrameJSON, filters: HistoryRecordFilters = emptyFilters) {
  return useMemo(() => ruleHistoryToRecords(stateHistory, filters), [filters, stateHistory]);
}

export function ruleHistoryToRecords(stateHistory?: DataFrameJSON, filters: HistoryRecordFilters = emptyFilters) {
  const { labels, stateFrom = 'all', stateTo = 'all' } = filters;

  if (!stateHistory?.data) {
    return { historyRecords: [] };
  }

  const filterMatchers = labels ? parsePromQLStyleMatcherLooseSafe(labels) : [];

  const [tsValues, lines] = stateHistory.data.values;
  const timestamps = isNumbers(tsValues) ? tsValues : [];

  // merge timestamp with "line"
  const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
    const line = lines[index];
    if (!isLine(line)) {
      return acc;
    }
    // values property can be undefined for some instance states (e.g. NoData)
    const filterMatch = line.labels && labelsMatchMatchers(line.labels, filterMatchers);
    const baseStateTo = mapStateWithReasonToBaseState(line.current);
    const baseStateFrom = mapStateWithReasonToBaseState(line.previous);
    const stateToMatch = stateTo !== StateFilterValues.all ? stateTo === baseStateTo : true;
    const stateFromMatch = stateFrom !== StateFilterValues.all ? stateFrom === baseStateFrom : true;
    if (filterMatch && stateToMatch && stateFromMatch) {
      acc.push({ timestamp, line });
    }

    return acc;
  }, []);

  return {
    historyRecords: logRecords,
  };
}
