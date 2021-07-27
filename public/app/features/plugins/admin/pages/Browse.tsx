import React, { ReactElement } from 'react';
import { css } from '@emotion/css';
import { SelectableValue, dateTimeParse } from '@grafana/data';
import { LoadingPlaceholder, Select, HorizontalGroup, RadioButtonGroup } from '@grafana/ui';
import { useLocation } from 'react-router-dom';
import { locationSearchToObject } from '@grafana/runtime';

import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { useHistory } from '../hooks/useHistory';
import { CatalogPlugin } from '../types';
import { Page as PluginPage } from '../components/Page';
import { Page } from 'app/core/components/Page/Page';
import { usePluginsByFilter } from '../hooks/usePlugins';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';
import { getNavModel } from 'app/core/selectors/navModel';

export default function Browse(): ReactElement | null {
  const location = useLocation();
  const query = locationSearchToObject(location.search);
  const navModel = useSelector((state: StoreState) => getNavModel(state.navIndex, 'plugins'));

  const q = query.q as string;
  const filterBy = (query.filterBy as string) ?? 'installed';
  const filterByType = (query.filterByType as string) ?? 'all';
  const sortBy = (query.sortBy as string) ?? 'name';

  const { plugins, isLoading, error } = usePluginsByFilter({ searchBy: q, filterBy, filterByType });
  const sortedPlugins = plugins.sort(sorters[sortBy]);
  const history = useHistory();

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: string) => {
    history.push({ query: { filterBy: value } });
  };

  const onFilterByTypeChange = (value: string) => {
    history.push({ query: { filterByType: value } });
  };

  const onSearch = (q: any) => {
    history.push({ query: { filterBy: 'all', filterByType: 'all', q } });
  };

  // How should we handle errors?
  if (error) {
    console.error(error.message);
    return null;
  }

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <PluginPage>
          <HorizontalGroup justify="space-between">
            <SearchField value={q} onSearch={onSearch} />
            <HorizontalGroup>
              <RadioButtonGroup
                value={filterByType}
                onChange={onFilterByTypeChange}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'datasource', label: 'Data sources' },
                  { value: 'app', label: 'Applications' },
                  { value: 'panel', label: 'Panels' },
                ]}
              />
              <RadioButtonGroup
                value={filterBy}
                onChange={onFilterByChange}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'installed', label: 'Installed' },
                ]}
              />
              <Select
                width={24}
                value={sortBy}
                onChange={onSortByChange}
                options={[
                  { value: 'name', label: 'Sort by name (A-Z)' },
                  { value: 'updated', label: 'Sort by updated date' },
                  { value: 'published', label: 'Sort by published date' },
                  { value: 'downloads', label: 'Sort by downloads' },
                ]}
              />
            </HorizontalGroup>
          </HorizontalGroup>
          <div
            className={css`
              margin-top: 24px;
            `}
          >
            {isLoading ? (
              <LoadingPlaceholder
                className={css`
                  margin-bottom: 0;
                `}
                text="Loading results"
              />
            ) : (
              <PluginList plugins={sortedPlugins} />
            )}
          </div>
        </PluginPage>
      </Page.Contents>
    </Page>
  );
}

const sorters: { [name: string]: (a: CatalogPlugin, b: CatalogPlugin) => number } = {
  name: (a: CatalogPlugin, b: CatalogPlugin) => a.name.localeCompare(b.name),
  updated: (a: CatalogPlugin, b: CatalogPlugin) =>
    dateTimeParse(b.updatedAt).valueOf() - dateTimeParse(a.updatedAt).valueOf(),
  published: (a: CatalogPlugin, b: CatalogPlugin) =>
    dateTimeParse(b.publishedAt).valueOf() - dateTimeParse(a.publishedAt).valueOf(),
  downloads: (a: CatalogPlugin, b: CatalogPlugin) => b.downloads - a.downloads,
};
