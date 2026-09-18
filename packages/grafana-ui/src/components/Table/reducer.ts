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

  return state;
}
