import React, { useState } from 'react';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Input, useStyles2, Spinner } from '@grafana/ui';
import { config } from '@grafana/runtime';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { useAsync } from 'react-use';
import { getGrafanaSearcher, QueryFilters } from '../service';
import { Table } from './table/Table';
import { TagFilter, TermCount } from 'app/core/components/TagFilter/TagFilter';
import { getTermCounts } from '../service/backend';

const node: NavModelItem = {
  id: 'search',
  text: 'Search',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const styles = useStyles2(getStyles);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const results = useAsync(() => {
    const filters: QueryFilters = {
      tags,
    };
    return getGrafanaSearcher().search(query, tags.length ? filters : undefined);
  }, [query, tags]);

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

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoFocus spellCheck={false} />
        <br />
        {results.loading && <Spinner />}
        {results.value?.body && (
          <div>
            <TagFilter isClearable tags={tags} tagOptions={getTagOptions} onChange={setTags} /> <br />
            <AutoSizer style={{ width: '100%', height: '2000px' }}>
              {({ width }) => {
                return (
                  <>
                    <Table data={results.value!.body} width={width} />
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
});
