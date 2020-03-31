import React, { FC, useState, useEffect, useReducer } from 'react';
import { SearchSrv } from 'app/core/services/search_srv';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { debounce } from 'lodash';
import { DashboardSection } from '../types';
import { backendSrv } from 'app/core/services/backend_srv';
const FETCH_RESULTS = 'FETCH_RESULTS';
const TOGGLE_SECTION = 'TOGGLE_SECTION';
const FETCH_ITEMS = 'FETCH_ITEMS';
const searchSrv = new SearchSrv();

const initialState = {
  results: [],
};

const searchReducer = (state: any, action: any) => {
  switch (action.type) {
    case FETCH_RESULTS:
      return { ...state, results: action.payload };
    case TOGGLE_SECTION: {
      const section = action.payload;
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section.id === result.id) {
            result.expanded = !result.expanded;
          }
          return result;
        }),
      };
    }
    case FETCH_ITEMS: {
      const { section, items } = action.payload;
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section.id === result.id) {
            result.items = items;
          }
          return result;
        }),
      };
    }
  }
};

export const DashboardSearch: FC = () => {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState({ query: '', parsedQuery: { text: '' }, tags: [], starred: false });
  const [state, dispatch] = useReducer(searchReducer, initialState);

  useEffect(() => {
    search();
  }, [query]);

  const search = debounce(() => {
    searchSrv.search(query).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  }, 300);

  const toggleSection = (section: DashboardSection) => {
    dispatch({ type: TOGGLE_SECTION, payload: section });
    if (!section.items.length) {
      backendSrv.search(query).then(items => {
        dispatch({ type: FETCH_ITEMS, payload: { section, items } });
      });
    }
  };

  return (
    <div className="search-container">
      <SearchField query={query} onChange={query => setQuery(q => ({ ...q, query }))} onKeyDown={() => {}} />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <div className="search-results-scroller">
            <div className="search-results-container">
              <SearchResults
                results={state.results}
                onSelectionChanged={() => {}}
                onTagSelected={() => {}}
                onFolderExpanding={() => {}}
                onToggleSelection={() => {}}
                editable={false}
                onToggleSection={toggleSection}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
