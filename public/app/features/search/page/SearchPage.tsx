import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner, InlineSwitch, InlineFieldRow, InlineField, Button } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { PreviewsSystemRequirements } from '../components/PreviewsSystemRequirements';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher, SearchQuery } from '../service';
import { SearchLayout } from '../types';

import { ActionRow, getValidQueryLayout } from './components/ActionRow';
import { FolderView } from './components/FolderView';
import { ManageActions } from './components/ManageActions';
import { SearchResultsGrid } from './components/SearchResultsGrid';
import { SearchResultsTable, SearchResultsProps } from './components/SearchResultsTable';
import { newSearchSelection, updateSearchSelection } from './selection';

const node: NavModelItem = {
  id: 'search',
  text: 'Search playground',
  subTitle: 'The body below will eventually live inside existing UI layouts',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const styles = useStyles2(getStyles);
  const { query, onQueryChange, onTagFilterChange, onDatasourceChange, onSortChange, onLayoutChange } = useSearchQuery(
    {}
  );
  const [showManage, setShowManage] = useState(false); // grid vs list view

  const [searchSelection, setSearchSelection] = useState(newSearchSelection());
  const layout = getValidQueryLayout(query);
  const isFolders = layout === SearchLayout.Folders;

  const results = useAsync(() => {
    let qstr = query.query as string;
    if (!qstr?.length) {
      qstr = '*';
    }
    const q: SearchQuery = {
      query: qstr,
      tags: query.tag as string[],
      ds_uid: query.datasource as string,
    };
    console.log('DO QUERY', q);
    return getGrafanaSearcher().search(q);
  }, [query, layout]);

  const [inputValue, setInputValue] = useState('');
  const onSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInputValue(e.currentTarget.value);
  };

  useDebounce(() => onQueryChange(inputValue), 200, [inputValue]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div className={styles.unsupported}>Unsupported</div>;
  }

  // This gets the possible tags from within the query results
  const getTagOptions = (): Promise<TermCount[]> => {
    const q: SearchQuery = {
      query: query.query ?? '*',
      tags: query.tag,
      ds_uid: query.datasource,
    };
    return getGrafanaSearcher().tags(q);
  };

  const onTagSelected = (tag: string) => {
    onTagFilterChange([...new Set(query.tag as string[]).add(tag)]);
  };

  const toggleSelection = (kind: string, uid: string) => {
    const current = searchSelection.isSelected(kind, uid);
    if (kind === 'folder') {
      // ??? also select all children?
    }
    setSearchSelection(updateSearchSelection(searchSelection, !current, kind, [uid]));
  };

  // function to update items when dashboards or folders are moved or deleted
  const onChangeItemsList = async () => {
    // clean up search selection
    setSearchSelection(newSearchSelection());
    // trigger again the search to the backend
    onQueryChange(inputValue);
  };

  const renderResults = () => {
    const value = results.value;

    if ((!value || !value.totalRows) && !isFolders) {
      if (results.loading && !value) {
        return <Spinner />;
      }

      return (
        <div className={styles.noResults}>
          <div>No results found for your query.</div>
          <br />
          <Button
            variant="secondary"
            onClick={() => {
              if (query.query) {
                onQueryChange('');
              }
              if (query.tag?.length) {
                onTagFilterChange([]);
              }
              if (query.datasource) {
                onDatasourceChange(undefined);
              }
            }}
          >
            Remove search constraints
          </Button>
        </div>
      );
    }

    const selection = showManage ? searchSelection.isSelected : undefined;
    if (layout === SearchLayout.Folders) {
      return <FolderView selection={selection} selectionToggle={toggleSelection} onTagSelected={onTagSelected} />;
    }

    return (
      <div style={{ height: '100%', width: '100%' }}>
        <AutoSizer>
          {({ width, height }) => {
            const props: SearchResultsProps = {
              response: value!,
              selection,
              selectionToggle: toggleSelection,
              width: width,
              height: height,
              onTagSelected: onTagSelected,
              onDatasourceChange: query.datasource ? onDatasourceChange : undefined,
            };

            if (layout === SearchLayout.Grid) {
              return <SearchResultsGrid {...props} />;
            }

            return <SearchResultsTable {...props} />;
          }}
        </AutoSizer>
      </div>
    );
  };

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <Input
          value={inputValue}
          onChange={onSearchQueryChange}
          autoFocus
          spellCheck={false}
          placeholder="Search for dashboards and panels"
          className={styles.searchInput}
          suffix={results.loading ? <Spinner /> : null}
        />
        <InlineFieldRow>
          <InlineField label="Show manage options">
            <InlineSwitch value={showManage} onChange={() => setShowManage(!showManage)} />
          </InlineField>
        </InlineFieldRow>

        {Boolean(searchSelection.items.size > 0) ? (
          <ManageActions items={searchSelection.items} onChange={onChangeItemsList} />
        ) : (
          <ActionRow
            onLayoutChange={(v) => {
              if (v === SearchLayout.Folders) {
                if (query.query) {
                  onQueryChange(''); // parent will clear the sort
                }
              }
              onLayoutChange(v);
            }}
            onSortChange={onSortChange}
            onTagFilterChange={onTagFilterChange}
            getTagOptions={getTagOptions}
            onDatasourceChange={onDatasourceChange}
            query={query}
          />
        )}

        {layout === SearchLayout.Grid && (
          <PreviewsSystemRequirements
            bottomSpacing={3}
            showPreviews={true}
            onRemove={() => onLayoutChange(SearchLayout.List)}
          />
        )}
        {renderResults()}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css`
    margin-bottom: 6px;
  `,
  unsupported: css`
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 18px;
  `,
  noResults: css`
    padding: ${theme.v1.spacing.md};
    background: ${theme.v1.colors.bg2};
    font-style: italic;
    margin-top: ${theme.v1.spacing.md};
  `,
});
