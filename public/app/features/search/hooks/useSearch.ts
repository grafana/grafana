import { useEffect } from 'react';
import { useDebounce } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { FETCH_RESULTS, FETCH_ITEMS, TOGGLE_SECTION, SEARCH_START, FETCH_ITEMS_START } from '../reducers/actionTypes';
import { DashboardSection, UseSearch } from '../types';
import { hasId, getParsedQuery } from '../utils';

const searchSrv = new SearchSrv();

/**
 * Base hook for search functionality.
 * Returns state and dispatch, among others, from 'reducer' param, so it can be
 * further extended.
 * @param query
 * @param reducer - return result of useReducer
 * @param params - custom params
 */
export const useSearch: UseSearch = (query, reducer, params = {}) => {
  const { queryParsing } = params;
  const [state, dispatch] = reducer;

  const search = () => {
    dispatch({ type: SEARCH_START });
    const parsedQuery = getParsedQuery(query, queryParsing);
    searchSrv.search(parsedQuery).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  };

  // Set loading state before debounced search
  useEffect(() => {
    dispatch({ type: SEARCH_START });
  }, [query.tag, query.sort, query.starred, query.layout]);

  useDebounce(search, 300, [query, queryParsing]);

  const onToggleSection = (section: DashboardSection) => {
    if (hasId(section.title) && !section.items.length) {
      dispatch({ type: FETCH_ITEMS_START, payload: section.id });
      backendSrv.search({ folderIds: [section.id] }).then(items => {
        dispatch({ type: FETCH_ITEMS, payload: { section, items } });
        dispatch({ type: TOGGLE_SECTION, payload: section });
      });
    } else {
      dispatch({ type: TOGGLE_SECTION, payload: section });
    }
  };

  return { state, dispatch, onToggleSection };
};
