import { useMemo } from 'react';

import { DataFrameJSON } from '@grafana/data';
import { mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { labelsMatchMatchers } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { historyDataFrameToLogRecords } from '../state-history/common';

import { StateFilterValues } from './constants';

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
  const { labels, stateFrom = StateFilterValues.all, stateTo = StateFilterValues.all } = filters;

  const allLogRecords = historyDataFrameToLogRecords(stateHistory);

  if (allLogRecords.length === 0) {
    return { historyRecords: [] };
  }

  const filterMatchers = labels ? parsePromQLStyleMatcherLooseSafe(labels) : [];

  const filteredRecords = allLogRecords.filter(({ line }) => {
    // values property can be undefined for some instance states (e.g. NoData)
    const filterMatch = line.labels && labelsMatchMatchers(line.labels, filterMatchers);
    const baseStateTo = mapStateWithReasonToBaseState(line.current);
    const baseStateFrom = mapStateWithReasonToBaseState(line.previous);
    const stateToMatch = stateTo !== StateFilterValues.all ? stateTo === baseStateTo : true;
    const stateFromMatch = stateFrom !== StateFilterValues.all ? stateFrom === baseStateFrom : true;
    return filterMatch && stateToMatch && stateFromMatch;
  });

  return {
    historyRecords: filteredRecords,
  };
}
