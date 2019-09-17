import { createLodashMemoizedSelector } from 'app/core/utils/reselect';
import { ExploreItemState } from 'app/types';
import { filterLogLevels, dedupLogRows } from 'app/core/logs_model';

export const exploreItemUIStateSelector = (itemState: ExploreItemState) => {
  const { showingGraph, showingTable, showingStartPage, dedupStrategy } = itemState;
  return {
    showingGraph,
    showingTable,
    showingStartPage,
    dedupStrategy,
  };
};

const logsSelector = (state: ExploreItemState) => state.logsResult;
const hiddenLogLevelsSelector = (state: ExploreItemState) => state.hiddenLogLevels;
const dedupStrategySelector = (state: ExploreItemState) => state.dedupStrategy;
export const deduplicatedLogsSelector = createLodashMemoizedSelector(
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
