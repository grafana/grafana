import React from 'react';
import { css } from '@emotion/css';
import { AppRootProps, SelectableValue, dateTimeParse } from '@grafana/data';
import { Field, LoadingPlaceholder, Select } from '@grafana/ui';

import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { HorizontalGroup } from '../components/HorizontalGroup';
import { usePlugins } from '../hooks/usePlugins';
import { useHistory } from '../hooks/useHistory';
import { Plugin } from '../types';
import { Page } from 'components/Page';

export const Browse = ({ query }: AppRootProps) => {
  const { q, filterBy, sortBy } = query;

  const plugins = usePlugins();
  const history = useHistory();

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: SelectableValue<string>) => {
    history.push({ query: { filterBy: value.value } });
  };

  const onSearch = (q: any) => {
    history.push({ query: { filterBy: null, q } });
  };

  const filteredPlugins = plugins.items
    // Filter by plugin type
    .filter((_) => !filterBy || _.typeCode === filterBy || filterBy === 'all')
    // Naïve search by checking if any of the properties contains the query string
    .filter((plugin) => {
      const fields = [plugin.name.toLowerCase(), plugin.orgName.toLowerCase()];
      return !q || fields.some((f) => f.includes(q.toLowerCase()));
    });

  filteredPlugins.sort(sorters[sortBy || 'name']);

  return (
    <Page>
      <SearchField value={q} onSearch={onSearch} />
      <HorizontalGroup>
        <div>
          {plugins.isLoading ? (
            <LoadingPlaceholder
              className={css`
                margin-bottom: 0;
              `}
              text="Loading results"
            />
          ) : (
            `${filteredPlugins.length} ${filteredPlugins.length > 1 ? 'results' : 'result'}`
          )}
        </div>
        <Field label="Show">
          <Select
            width={15}
            value={filterBy || 'all'}
            onChange={onFilterByChange}
            options={[
              { value: 'all', label: 'All' },
              { value: 'panel', label: 'Panels' },
              { value: 'datasource', label: 'Data sources' },
              { value: 'app', label: 'Apps' },
            ]}
          />
        </Field>
        <Field label="Sort by">
          <Select
            width={20}
            value={sortBy || 'name'}
            onChange={onSortByChange}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'popularity', label: 'Popularity' },
              { value: 'updated', label: 'Updated date' },
              { value: 'published', label: 'Published date' },
              { value: 'downloads', label: 'Downloads' },
            ]}
          />
        </Field>
      </HorizontalGroup>

      {!plugins.isLoading && <PluginList plugins={filteredPlugins} />}
    </Page>
  );
};

const sorters: { [name: string]: (a: Plugin, b: Plugin) => number } = {
  name: (a: Plugin, b: Plugin) => a.name.localeCompare(b.name),
  updated: (a: Plugin, b: Plugin) => dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf(),
  published: (a: Plugin, b: Plugin) => dateTimeParse(b.createdAt).valueOf() - dateTimeParse(a.createdAt).valueOf(),
  downloads: (a: Plugin, b: Plugin) => b.downloads - a.downloads,
  popularity: (a: Plugin, b: Plugin) => b.popularity - a.popularity,
};
