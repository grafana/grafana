import { reportInteraction } from '@grafana/runtime';

const QUERY_LIBRARY_EXPLORE_EVENT = 'query_library_explore_clicked';

export function queryLibraryTrackToggle(open: boolean) {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'query_library_toggle',
    type: open ? 'open' : 'close',
  });
}

export function queryLibraryTrackAddFromQueryHistory(datasourceType: string) {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'add_query_from_query_history',
    type: datasourceType,
  });
}

export function queryLibraryTrackAddFromQueryHistoryAddModalShown() {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'add_query_modal_from_query_history',
    type: 'open',
  });
}

export function queryLibraryTrackAddFromQueryRow(datasourceType: string) {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'add_query_from_query_row',
    type: datasourceType,
  });
}

export function queryLibaryTrackDeleteQuery() {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'delete_query',
  });
}

export function queryLibraryTrackRunQuery(datasourceType: string) {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'run_query',
    type: datasourceType,
  });
}

export function queryLibraryTrackAddOrEditDescription() {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'add_or_edit_description',
  });
}

export function queryLibraryTrackFilterDatasource() {
  reportInteraction(QUERY_LIBRARY_EXPLORE_EVENT, {
    item: 'filter_datasource',
  });
}
