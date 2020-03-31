import React, { FC, useState, useEffect } from 'react';
import { SearchSrv } from 'app/core/services/search_srv';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

const searchSrv = new SearchSrv();

export const DashboardSearch: FC = () => {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState({ query: '', parsedQuery: { text: '' }, tags: [], starred: false });

  useEffect(() => {
    search();
  }, []);

  const search = () => {
    searchSrv.search(query).then(results => {
      console.log('res', results);
      setResults(results);
    });
  };

  return (
    <div className="search-container">
      <SearchField query={query} onChange={query => setQuery(q => ({ ...q, query }))} />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <div className="search-results-scroller">
            <div className="search-results-container" grafana-scrollbar>
              <h6 ng-show="!ctrl.isLoading && ctrl.results.length === 0">
                No dashboards matching your query were found.
              </h6>

              <SearchResults
                results={results}
                onSelectionChanged={() => {}}
                onTagSelected={() => {}}
                onFolderExpanding={() => {}}
                onToggleSelection={() => {}}
                editable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
