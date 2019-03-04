import { ExploreItemState } from 'app/types';
import { filterLogLevels, dedupLogRows } from 'app/core/logs_model';
import { createSelector } from 'reselect';

export const exploreItemUIStateSelector = (itemState: ExploreItemState) => {
  const { showingGraph, showingLogs, showingTable, showingStartPage, dedupStrategy } = itemState;
  return {
    showingGraph,
    showingLogs,
    showingTable,
    showingStartPage,
    dedupStrategy,
  };
};

const logsSelector = (state: ExploreItemState) => state.logsResult;
const hiddenLogLevelsSelector = (state: ExploreItemState) => state.hiddenLogLevels;
const dedupStrategySelector = (state: ExploreItemState) => state.dedupStrategy;

export const deduplicatedLogsSelector = createSelector(
  logsSelector,
  hiddenLogLevelsSelector,
  dedupStrategySelector,
  (logs, hiddenLogLevels, dedupStrategy) => {
    if (!logs) {
      return null;
    }
    const filteredData = filterLogLevels(logs, new Set(hiddenLogLevels));
    return dedupLogRows(filteredData, dedupStrategy);
  }
);
