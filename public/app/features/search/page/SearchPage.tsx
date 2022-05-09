import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeGrid } from 'react-window';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner, InlineSwitch, InlineFieldRow, InlineField, Button } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { PreviewsSystemRequirements } from '../components/PreviewsSystemRequirements';
import { SearchCard } from '../components/SearchCard';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher, SearchQuery } from '../service';
import { DashboardSearchItemType, DashboardSectionItem, SearchLayout } from '../types';

import { ActionRow, getValidQueryLayout } from './components/ActionRow';
import { ManageActions } from './components/ManageActions';
import { SearchResultsTable } from './components/SearchResultsTable';
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

  const results = useAsync(() => {
    const q: SearchQuery = {
      query: query.query as string,
      tags: query.tag as string[],
      ds_uid: query.datasource as string,
    };
    return getGrafanaSearcher().search(q);
  }, [query]);

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

  const layout = getValidQueryLayout(query);
  const showPreviews = layout === SearchLayout.Grid && config.featureToggles.dashboardPreviews;

  const renderResults = () => {
    if (results.loading) {
      return <Spinner />;
    }

    if (!results.value?.totalRows) {
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

    return (
      <div style={{ height: '100%', width: '100%' }}>
        <AutoSizer>
          {({ width, height }) => {
            if (showPreviews) {
              // Hacked to reuse existing SearchCard (and old DashboardSectionItem)
              const itemProps = {
                editable: showManage,
                onToggleChecked: (item: any) => {
                  const d = item as DashboardSectionItem;
                  const t = d.type === DashboardSearchItemType.DashFolder ? 'folder' : 'dashboard';
                  toggleSelection(t, d.uid!);
                },
                onTagSelected,
              };

              const view = results.value.view;
              const numColumns = Math.ceil(width / 320);
              const cellWidth = width / numColumns;
              const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
              const numRows = Math.ceil(view.length / numColumns);
              return (
                <FixedSizeGrid
                  columnCount={numColumns}
                  columnWidth={cellWidth}
                  rowCount={numRows}
                  rowHeight={cellHeight}
                  className={styles.wrapper}
                  innerElementType="ul"
                  height={height}
                  width={width - 2}
                >
                  {({ columnIndex, rowIndex, style }) => {
                    const index = rowIndex * numColumns + columnIndex;
                    const item = view.get(index);
                    const kind = item.kind ?? 'dashboard';
                    const facade: DashboardSectionItem = {
                      uid: item.uid,
                      title: item.name,
                      url: item.url,
                      uri: item.url,
                      type: kind === 'folder' ? DashboardSearchItemType.DashFolder : DashboardSearchItemType.DashDB,
                      id: 666, // do not use me!
                      isStarred: false,
                      tags: item.tags ?? [],
                      checked: searchSelection.isSelected(kind, item.uid),
                    };

                    // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                    // And without this wrapper there is no room for that margin
                    return item ? (
                      <li style={style} className={styles.virtualizedGridItemWrapper}>
                        <SearchCard key={item.uid} {...itemProps} item={facade} />
                      </li>
                    ) : null;
                  }}
                </FixedSizeGrid>
              );
            }

            if (layout === SearchLayout.Folders) {
              return <div>TODO... show nested views</div>;
            }

            return (
              <SearchResultsTable
                response={results.value}
                selection={showManage ? searchSelection.isSelected : undefined}
                selectionToggle={toggleSelection}
                width={width}
                height={height}
                onTagSelected={onTagSelected}
                onDatasourceChange={onDatasourceChange}
              />
            );
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
        />
        <InlineFieldRow>
          <InlineField label="Show manage options">
            <InlineSwitch value={showManage} onChange={() => setShowManage(!showManage)} />
          </InlineField>
        </InlineFieldRow>

        {Boolean(searchSelection.items.size > 0) ? (
          <ManageActions items={searchSelection.items} />
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

        {showPreviews && (
          <PreviewsSystemRequirements
            bottomSpacing={3}
            showPreviews={showPreviews}
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
  virtualizedGridItemWrapper: css`
    padding: 4px;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;

    > ul {
      list-style: none;
    }
  `,
  noResults: css`
    padding: ${theme.v1.spacing.md};
    background: ${theme.v1.colors.bg2};
    font-style: italic;
    margin-top: ${theme.v1.spacing.md};
  `,
});
