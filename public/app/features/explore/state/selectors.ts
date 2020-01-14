import { createSelector } from 'reselect';
import { ExploreItemState } from 'app/types';
import { filterLogLevels, dedupLogRows } from 'app/core/logs_model';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { DataSourceSelectItem } from '@grafana/data';

const logsRowsSelector = (state: ExploreItemState) => state.logsResult && state.logsResult.rows;
const hiddenLogLevelsSelector = (state: ExploreItemState) => state.hiddenLogLevels;
const dedupStrategySelector = (state: ExploreItemState) => state.dedupStrategy;
export const deduplicatedRowsSelector = createSelector(
  logsRowsSelector,
  hiddenLogLevelsSelector,
  dedupStrategySelector,
  function dedupRows(rows, hiddenLogLevels, dedupStrategy) {
    if (!(rows && rows.length)) {
      return rows;
    }
    const filteredRows = filterLogLevels(rows, new Set(hiddenLogLevels));
    return dedupLogRows(filteredRows, dedupStrategy);
  }
);

export const getExploreDatasources = (): DataSourceSelectItem[] => {
  return getDatasourceSrv()
    .getExternal()
    .map(
      (ds: any) =>
        ({
          value: ds.name,
          name: ds.name,
          meta: ds.meta,
        } as DataSourceSelectItem)
    );
};
