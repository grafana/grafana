import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeGrid } from 'react-window';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner, Button, InlineSwitch, InlineFieldRow, InlineField } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { SearchCard } from '../components/SearchCard';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher, QueryFilters } from '../service';
import { getTermCounts } from '../service/backend';
import { toDashboardSectionItem } from '../service/searcher';
import { SearchLayout } from '../types';

import { ActionRow } from './components/ActionRow';
import { Table } from './table/Table';

const node: NavModelItem = {
  id: 'search',
  text: 'Search',
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

  // HACK for grid view
  const itemProps = {
    editable: showManage,
    onToggleChecked: (v: any) => {
      console.log('CHECKED?', v);
    },
    onTagSelected: () => {},
  };

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query.query} onChange={onSearchQueryChange} autoFocus spellCheck={false} />
        <InlineFieldRow>
          <InlineField label="Manage">
            <InlineSwitch value={showManage} onChange={() => setShowManage(!showManage)} />
          </InlineField>
        </InlineFieldRow>
        <br />
        {results.loading && <Spinner />}
        {results.value?.body && (
          <div>
            {query.datasource && (
              <Button
                icon="times"
                variant="secondary"
                onClick={() => onDatasourceChange(undefined)}
                className={styles.clearClick}
              >
                Datasource: {query.datasource}
              </Button>
            )}
            <ActionRow
              onLayoutChange={onLayoutChange}
              onSortChange={onSortChange}
              onTagFilterChange={onTagFilterChange}
              getTagOptions={getTagOptions}
              query={query}
            />
            <AutoSizer style={{ width: '100%', height: '700px' }}>
              {({ width, height }) => {
                if (query.layout === SearchLayout.Grid && config.featureToggles.dashboardPreviews) {
                  const items = toDashboardSectionItem(results.value!.body);

                  const numColumns = Math.ceil(width / 320);
                  const cellWidth = width / numColumns;
                  const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
                  const numRows = Math.ceil(items.length / numColumns);
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
                        const item = items[index];
                        // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                        // And without this wrapper there is no room for that margin
                        return item ? (
                          <li style={style} className={styles.virtualizedGridItemWrapper}>
                            <SearchCard key={item.uid} {...itemProps} item={item} />
                          </li>
                        ) : null;
                      }}
                    </FixedSizeGrid>
                  );
                }

                return (
                  <>
                    <Table
                      data={results.value!.body}
                      showCheckbox={showManage}
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

  clearClick: css`
    &:hover {
      text-decoration: line-through;
    }
    margin-bottom: 20px;
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
