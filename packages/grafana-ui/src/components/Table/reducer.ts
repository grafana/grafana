import { type GrafanaTableColumn, type GrafanaTableState, type TableRTProps } from './types';

export function getInitialState(
  initialSortBy: TableRTProps['initialSortBy'],
  columns: GrafanaTableColumn[]
): Partial<GrafanaTableState> {
  const state: Partial<GrafanaTableState> = {};

  if (initialSortBy) {
    state.sorting = [];

    for (const sortBy of initialSortBy) {
      for (const col of columns) {
        if (col.header === sortBy.displayName) {
          state.sorting.push({ id: col.id, desc: Boolean(sortBy.desc) });
        }
      }
    }
  }

  // #region agent log
  require('fs').appendFileSync(
    '/opt/cursor/logs/debug.log',
    JSON.stringify({
      location: 'Table/reducer.ts:getInitialState',
      message: 'computed initial sorting from columns',
      data: {
        initialSortBy,
        columnIds: columns.map((c) => c.id),
        columnHeaders: columns.map((c) => c.header),
        sorting: state.sorting ?? [],
      },
      timestamp: Date.now(),
      hypothesisId: 'C,E',
    }) + '\n'
  );
  // #endregion

  return state;
}
