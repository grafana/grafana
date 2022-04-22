import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner, Button } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';

import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher, QueryFilters } from '../service';
import { getTermCounts } from '../service/backend';

import { Table } from './table/Table';

const node: NavModelItem = {
  id: 'search',
  text: 'Search',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const styles = useStyles2(getStyles);
  const { query, onQueryChange, onTagFilterChange, onDatasourceChange } = useSearchQuery({});

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

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query.query} onChange={onSearchQueryChange} autoFocus spellCheck={false} />
        <br />
        {results.loading && <Spinner />}
        {results.value?.body && (
          <div>
            <TagFilter isClearable tags={query.tag} tagOptions={getTagOptions} onChange={onTagChange} /> <br />
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
            <AutoSizer style={{ width: '100%', height: '2000px' }}>
              {({ width }) => {
                return (
                  <>
                    <Table
                      data={results.value!.body}
                      width={width}
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
});
