import { useReducer } from 'react';
import { useDebounce } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { FETCH_RESULTS, FETCH_ITEMS, TOGGLE_SECTION } from '../reducers/actionTypes';
import { dashboardsSearchState, searchReducer } from '../reducers/dashboardSearch';
import { DashboardQuery, DashboardSection } from '../types';
import { parseQuery, hasId } from '../utils';

const searchSrv = new SearchSrv();

/**
 * Base hook for search functionality. In addition to search related data, returns
 * dispatch from useReducer, so the functionality can be extended by other hooks.
 * Accepts optional reducer param, which should extend searchReducer or be able
 * to handle its action types
 * @param query
 * @param queryParsing - toggle to enable custom query parsing
 * @param reducer
 */
export const useSearch = (query: DashboardQuery, queryParsing = false, reducer = searchReducer) => {
  const [{ results, loading }, dispatch] = useReducer(reducer, dashboardsSearchState);

  const search = () => {
    if (queryParsing) {
      let folderIds: number[] = [];
      if (parseQuery(query.query).folder === 'current') {
        const { folderId } = getDashboardSrv().getCurrent().meta;
        if (folderId) {
          folderIds.push(folderId);
        }
      }
      searchSrv.search({ ...query, query: parseQuery(query.query).text, folderIds }).then(results => {
        dispatch({ type: FETCH_RESULTS, payload: results });
      });
    }
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

  return { results, loading, onToggleSection, dispatch };
};
