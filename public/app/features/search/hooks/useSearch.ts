import { useDebounce } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { FETCH_RESULTS, FETCH_ITEMS, TOGGLE_SECTION } from '../reducers/actionTypes';
import { DashboardSection, UseSearch } from '../types';
import { parseQuery, hasId } from '../utils';

const searchSrv = new SearchSrv();

/**
 * Base hook for search functionality.
 * Returns state and dispatch, among others, from 'reducer' param, so it can be
 * further extended.
 * @param query
 * @param reducer - return result of useReducer
 * @param queryParsing - toggle to enable custom query parsing
 */
export const useSearch: UseSearch = (query, reducer, queryParsing = false) => {
  const [state, dispatch] = reducer;

  const search = () => {
    let folderIds: number[] = [];
    let q = query;
    if (queryParsing) {
      if (parseQuery(query.query).folder === 'current') {
        const { folderId } = getDashboardSrv().getCurrent().meta;
        if (folderId) {
          folderIds.push(folderId);
        }
      }
      q = { ...q, query: parseQuery(query.query).text as string, folderIds };
    }
    searchSrv.search(q).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  };

  useDebounce(search, 300, [query]);

  const onToggleSection = (section: DashboardSection) => {
    if (hasId(section.title) && !section.items.length) {
      backendSrv.search({ ...query, folderIds: [section.id] }).then(items => {
        dispatch({ type: FETCH_ITEMS, payload: { section, items } });
        dispatch({ type: TOGGLE_SECTION, payload: section });
      });
    } else {
      dispatch({ type: TOGGLE_SECTION, payload: section });
    }
  };

  return { state, dispatch, onToggleSection };
};
