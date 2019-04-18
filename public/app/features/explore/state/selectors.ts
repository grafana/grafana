import moment, { Moment } from 'moment';
import { createLodashMemoizedSelector } from 'app/core/utils/reselect';
import * as dateMath from 'app/core/utils/datemath';
import { ExploreItemState } from 'app/types';
import { filterLogLevels, dedupLogRows } from 'app/core/logs_model';
import { TimeZone, TimeRange, RawTimeRange } from '@grafana/ui';

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

const parseRawTime = (value): Moment | string => {
  if (value === null) {
    return null;
  }

  if (value.indexOf('now') !== -1) {
    return value;
  }
  if (value.length === 8) {
    return moment.utc(value, 'YYYYMMDD');
  }
  if (value.length === 15) {
    return moment.utc(value, 'YYYYMMDDTHHmmss');
  }
  // Backward compatibility
  if (value.length === 19) {
    return moment.utc(value, 'YYYY-MM-DD HH:mm:ss');
  }

  if (!isNaN(value)) {
    const epoch = parseInt(value, 10);
    return moment.utc(epoch);
  }

  return null;
};

export const timeRangeFromUrlSelector = (range: RawTimeRange, timeZone: TimeZone): TimeRange => {
  const raw = {
    from: parseRawTime(range.from),
    to: parseRawTime(range.to),
  };

  return {
    from: dateMath.parse(raw.from, false, timeZone.raw as any),
    to: dateMath.parse(raw.to, true, timeZone.raw as any),
    raw,
  };
};
