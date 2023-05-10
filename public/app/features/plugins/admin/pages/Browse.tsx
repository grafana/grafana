import { css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';

import { SelectableValue, GrafanaTheme2, PluginType } from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';
import { LoadingPlaceholder, Select, RadioButtonGroup, useStyles2, Tooltip, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { useSelector } from 'app/types';

import { HorizontalGroup } from '../components/HorizontalGroup';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { Sorters } from '../helpers';
import { useHistory } from '../hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable, useDisplayMode } from '../state/hooks';
import { PluginListDisplayMode } from '../types';

export default function Browse({ route }: GrafanaRouteComponentProps): ReactElement | null {
  const location = useLocation();
  const locationSearch = locationSearchToObject(location.search);
  const navModel = useSelector((state) => getNavModel(state.navIndex, 'plugins'));
  const { displayMode, setDisplayMode } = useDisplayMode();
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const remotePluginsAvailable = useIsRemotePluginsAvailable();
  const keyword = (locationSearch.q as string) || '';
  const filterBy = (locationSearch.filterBy as string) || 'installed';
  const filterByType = (locationSearch.filterByType as PluginType | 'all') || 'all';
  const sortBy = (locationSearch.sortBy as Sorters) || Sorters.nameAsc;
  const { isLoading, error, plugins } = useGetAll(
    {
      keyword,
      type: filterByType !== 'all' ? filterByType : undefined,
      isInstalled: filterBy === 'installed' ? true : undefined,
      isCore: filterBy === 'installed' ? undefined : false, // We only would like to show core plugins when the user filters to installed plugins
    },
    sortBy
  );
  const filterByOptions = [
    { value: 'all', label: 'All' },
    { value: 'installed', label: 'Installed' },
  ];

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: string) => {
    history.push({ query: { filterBy: value } });
  };

  const onFilterByTypeChange = (value: SelectableValue<string>) => {
    history.push({ query: { filterByType: value.value } });
  };

  const onSearch = (q: string) => {
    history.push({ query: { filterBy, filterByType, q } });
  };

  // How should we handle errors?
  if (error) {
    console.error(error.message);
    return null;
  }

  const subTitle = config.featureToggles.dataConnectionsConsole ? (
    <div>
      Extend the Grafana experience with panel plugins and apps. To find more data sources go to{' '}
      <a className="external-link" href={`${CONNECTIONS_ROUTES.AddNewConnection}?cat=data-source`}>
        Connections
      </a>
      .
    </div>
  ) : (
    <div>Extend the Grafana experience with panel plugins and apps.</div>
  );

  return (
    <Page navModel={navModel} subTitle={subTitle}>
      <Page.Contents>
        <HorizontalGroup wrap>
          <Field label="Search">
            <SearchField value={keyword} onSearch={onSearch} />
          </Field>
          <HorizontalGroup wrap className={styles.actionBar}>
            {/* Filter by type */}
            <Field label="Type">
              <Select
                aria-label="Plugin type filter"
                value={filterByType}
                onChange={onFilterByTypeChange}
                width={18}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'datasource', label: 'Data sources' },
                  { value: 'panel', label: 'Panels' },
                  { value: 'app', label: 'Applications' },
                ]}
              />
            </Field>

            {/* Filter by installed / all */}
            {remotePluginsAvailable ? (
              <Field label="State">
                <RadioButtonGroup value={filterBy} onChange={onFilterByChange} options={filterByOptions} />
              </Field>
            ) : (
              <Tooltip
                content="This filter has been disabled because the Grafana server cannot access grafana.com"
                placement="top"
              >
                <div>
                  <Field label="State">
                    <RadioButtonGroup
                      disabled={true}
                      value={filterBy}
                      onChange={onFilterByChange}
                      options={filterByOptions}
                    />
                  </Field>
                </div>
              </Tooltip>
            )}

            {/* Sorting */}
            <Field label="Sort">
              <Select
                aria-label="Sort Plugins List"
                width={24}
                value={sortBy}
                onChange={onSortByChange}
                options={[
                  { value: 'nameAsc', label: 'By name (A-Z)' },
                  { value: 'nameDesc', label: 'By name (Z-A)' },
                  { value: 'updated', label: 'By updated date' },
                  { value: 'published', label: 'By published date' },
                  { value: 'downloads', label: 'By downloads' },
                ]}
              />
            </Field>

            {/* Display mode */}
            <Field label="View">
              <RadioButtonGroup<PluginListDisplayMode>
                className={styles.displayAs}
                value={displayMode}
                onChange={setDisplayMode}
                options={[
                  {
                    value: PluginListDisplayMode.Grid,
                    icon: 'table',
                    description: 'Display plugins in a grid layout',
                  },
                  { value: PluginListDisplayMode.List, icon: 'list-ul', description: 'Display plugins in list' },
                ]}
              />
            </Field>
          </HorizontalGroup>
        </HorizontalGroup>
        <div className={styles.listWrap}>
          {isLoading ? (
            <LoadingPlaceholder
              className={css`
                margin-bottom: 0;
              `}
              text="Loading results"
            />
          ) : (
            <PluginList plugins={plugins} displayMode={displayMode} />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actionBar: css`
    ${theme.breakpoints.up('xl')} {
      margin-left: auto;
    }
  `,
  listWrap: css`
    margin-top: ${theme.spacing(2)};
  `,
  displayAs: css`
    svg {
      margin-right: 0;
    }
  `,
});
