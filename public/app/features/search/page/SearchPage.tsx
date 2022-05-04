import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeGrid } from 'react-window';

import { DataFrameView, GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner, InlineSwitch, InlineFieldRow, InlineField } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { PreviewsSystemRequirements } from '../components/PreviewsSystemRequirements';
import { SearchCard } from '../components/SearchCard';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher, QueryFilters, QueryResult } from '../service';
import { getTermCounts } from '../service/backend';
import { DashboardSearchItemType, DashboardSectionItem, SearchLayout } from '../types';

import { ActionRow } from './components/ActionRow';
import { SearchResultsTable } from './components/SearchResultsTable';

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

  const results = useAsync(() => {
    const { query: searchQuery, tag: tags, datasource } = query;

    const filters: QueryFilters = {
      tags,
      datasource,
    };
    return getGrafanaSearcher().search(searchQuery, tags.length || datasource ? filters : undefined);
  }, [query]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div className={styles.unsupported}>Unsupported</div>;
  }

  // This gets the possible tags from within the query results
  const getTagOptions = (): Promise<TermCount[]> => {
    const tags = results.value?.body.fields.find((f) => f.name === 'tags');

    if (tags) {
      return Promise.resolve(getTermCounts(tags));
    }
    return Promise.resolve([]);
  };

  const onSearchQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.currentTarget.value);
  };

  const onTagChange = (tags: string[]) => {
    onTagFilterChange(tags);
  };

  const onTagSelected = (tag: string) => {
    onTagFilterChange([...new Set(query.tag as string[]).add(tag)]);
  };

  const showPreviews = query.layout === SearchLayout.Grid && config.featureToggles.dashboardPreviews;

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input
          value={query.query}
          onChange={onSearchQueryChange}
          autoFocus
          spellCheck={false}
          placeholder="Search for dashboards and panels"
        />
        <InlineFieldRow>
          <InlineField label="Show the manage options">
            <InlineSwitch value={showManage} onChange={() => setShowManage(!showManage)} />
          </InlineField>
        </InlineFieldRow>
        <br />
        {results.loading && <Spinner />}
        {results.value?.body && (
          <div>
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

            <PreviewsSystemRequirements
              bottomSpacing={3}
              showPreviews={showPreviews}
              onRemove={() => onLayoutChange(SearchLayout.List)}
            />

            <AutoSizer style={{ width: '100%', height: '700px' }}>
              {({ width, height }) => {
                if (showPreviews) {
                  const df = results.value?.body!;
                  const view = new DataFrameView<QueryResult>(df);

                  // HACK for grid view
                  const itemProps = {
                    editable: showManage,
                    onToggleChecked: (v: any) => {
                      console.log('CHECKED?', v);
                    },
                    onTagSelected,
                  };

                  const numColumns = Math.ceil(width / 320);
                  const cellWidth = width / numColumns;
                  const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
                  const numRows = Math.ceil(df.length / numColumns);
                  return (
                    <FixedSizeGrid
                      columnCount={numColumns}
                      columnWidth={cellWidth}
                      rowCount={numRows}
                      rowHeight={cellHeight}
                      className={styles.wrapper}
                      innerElementType="ul"
                      height={height}
                      width={width}
                    >
                      {({ columnIndex, rowIndex, style }) => {
                        const index = rowIndex * numColumns + columnIndex;
                        const item = view.get(index);
                        const facade: DashboardSectionItem = {
                          uid: item.uid,
                          title: item.name,
                          url: item.url,
                          uri: item.url,
                          type:
                            item.kind === 'folder'
                              ? DashboardSearchItemType.DashFolder
                              : DashboardSearchItemType.DashDB,
                          id: 666, // do not use me!
                          isStarred: false,
                          tags: item.tags ?? [],
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

                return (
                  <>
                    <SearchResultsTable
                      data={results.value!.body}
                      showCheckbox={showManage}
                      layout={query.layout}
                      width={width}
                      height={height}
                      tags={query.tag}
                      onTagFilterChange={onTagChange}
                      onDatasourceChange={onDatasourceChange}
                    />
                  </>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
});
