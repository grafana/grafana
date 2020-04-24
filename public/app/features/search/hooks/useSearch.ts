import { useEffect } from 'react';
import { useDebounce } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { FETCH_RESULTS, FETCH_ITEMS, TOGGLE_SECTION, SEARCH_START } from '../reducers/actionTypes';
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
export const useSearch: UseSearch = (query, reducer, params) => {
  const { queryParsing, folderUid, searchCallback } = params;
  const [state, dispatch] = reducer;

  const search = () => {
    dispatch({ type: SEARCH_START });
    const parsedQuery = getParsedQuery(query, queryParsing);
    searchSrv.search(parsedQuery).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });

      if (searchCallback) {
        searchCallback(folderUid);
      }
    });
  };

  // Set loading state before debounced search
  useEffect(() => {
    dispatch({ type: SEARCH_START });
  }, [query.tag, query.sort, query.starred]);

  useDebounce(search, 300, [query.query, query.tag, query.sort, query.starred, folderUid, queryParsing]);

  // TODO as possible improvement, show spinner after expanding section while items are fetching
  const onToggleSection = (section: DashboardSection) => {
    if (hasId(section.title) && !section.items.length) {
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
