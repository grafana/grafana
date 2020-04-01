import React, { FC, useState, useReducer } from 'react';
import { useDebounce } from 'react-use';
import { parse, SearchParserResult } from 'search-query-parser';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchQuery } from 'app/core/components/search/search';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { DashboardSection, SearchAction } from '../types';

const FETCH_RESULTS = 'FETCH_RESULTS';
const TOGGLE_SECTION = 'TOGGLE_SECTION';
const FETCH_ITEMS = 'FETCH_ITEMS';
const TOGGLE_CUSTOM = 'TOGGLE_CUSTOM';

const searchSrv = new SearchSrv();

const parseQuery = (query: string) => {
  const parsedQuery = parse(query, {
    keywords: ['folder'],
  });

  if (typeof parsedQuery === 'string') {
    return {
      text: parsedQuery,
    } as SearchParserResult;
  }

  return parsedQuery;
};

interface State {
  results: DashboardSection[];
}

const initialState: State = {
  results: [],
};

const searchReducer = (state: any, action: SearchAction) => {
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
    case TOGGLE_CUSTOM: {
      const section = action.payload;
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (result.title === section.title) {
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

const defaultQuery: SearchQuery = { query: '', parsedQuery: { text: '' }, tags: [], starred: false };

export const DashboardSearch: FC = () => {
  const [query, setQuery] = useState(defaultQuery);
  const [state, dispatch] = useReducer(searchReducer, initialState);

  useDebounce(
    () => {
      search();
    },
    300,
    [query]
  );

  const search = () => {
    searchSrv.search(query).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  };

  const toggleSection = (section: DashboardSection) => {
    if (['Recent', 'Starred'].includes(section.title)) {
      dispatch({ type: TOGGLE_CUSTOM, payload: section });
    } else {
      if (!section.items.length) {
        backendSrv.search({ ...defaultQuery, folderIds: [section.id] }).then(items => {
          dispatch({ type: FETCH_ITEMS, payload: { section, items } });
          dispatch({ type: TOGGLE_SECTION, payload: section });
        });
      } else {
        dispatch({ type: TOGGLE_SECTION, payload: section });
      }
    }
  };

  const onQueryChange = (searchQuery: string) => {
    setQuery(q => ({
      ...q,
      parsedQuery: parseQuery(searchQuery),
      query: searchQuery,
    }));
  };

  const onKeyDown = () => {};

  return (
    <div className="search-container">
      <SearchField query={query} onChange={onQueryChange} onKeyDown={onKeyDown} />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <div className="search-results-scroller">
            <div className="search-results-container">
              <SearchResults
                results={state.results}
                onTagSelected={() => {}}
                dispatch={dispatch}
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
