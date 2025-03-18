import { css } from '@emotion/css';
import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { SelectableValue, GrafanaTheme2, PluginType } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { Select, RadioButtonGroup, useStyles2, Tooltip, Field, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { useSelector } from 'app/types';

import { HorizontalGroup } from '../components/HorizontalGroup';
import { PluginList } from '../components/PluginList';
import { RoadmapLinks } from '../components/RoadmapLinks';
import { SearchField } from '../components/SearchField';
import { UpdateAllModal } from '../components/UpdateAllModal';
import { Sorters } from '../helpers';
import { useHistory } from '../hooks/useHistory';
import { useGetAll, useGetUpdatable, useIsRemotePluginsAvailable } from '../state/hooks';

export default function Browse() {
  const location = useLocation();
  const locationSearch = locationSearchToObject(location.search);
  const navModel = useSelector((state) => getNavModel(state.navIndex, 'plugins'));
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const remotePluginsAvailable = useIsRemotePluginsAvailable();
  const keyword = locationSearch.q?.toString() || '';
  const filterBy = locationSearch.filterBy?.toString() || 'all';
  const filterByType = (locationSearch.filterByType as PluginType | 'all') || 'all';
  const sortBy = (locationSearch.sortBy as Sorters) || Sorters.nameAsc;
  const { isLoading, error, plugins } = useGetAll(
    {
      keyword,
      type: filterByType !== 'all' ? filterByType : undefined,
      isInstalled: filterBy === 'installed' ? true : undefined,
      hasUpdate: filterBy === 'has-update' ? true : undefined,
    },
    sortBy
  );

  const filterByOptions = [
    { value: 'all', label: 'All' },
    { value: 'installed', label: 'Installed' },
    { value: 'has-update', label: 'New Updates' },
  ];

  const { isLoading: areUpdatesLoading, updatablePlugins } = useGetUpdatable();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const disableUpdateAllButton = updatablePlugins.length <= 0 || areUpdatesLoading;

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

  const onUpdateAll = () => {
    setShowUpdateModal(true);
  };

  // How should we handle errors?
  if (error) {
    console.error(error.message);
    return null;
  }

  const subTitle = (
    <div>
      Extend the Grafana experience with panel plugins and apps. To find more data sources go to{' '}
      <a className="external-link" href={`${CONNECTIONS_ROUTES.AddNewConnection}?cat=data-source`}>
        Connections
      </a>
      .
    </div>
  );
  const updateAll = (
    <Button disabled={disableUpdateAllButton} onClick={onUpdateAll}>
      <Trans i18nKey="plugins.catalog.update-all.button">Update all</Trans>
      {disableUpdateAllButton ? '' : ` (${updatablePlugins.length})`}
    </Button>
  );

  return (
    <Page navModel={navModel} actions={updateAll} subTitle={subTitle}>
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
          </HorizontalGroup>
        </HorizontalGroup>
        <div className={styles.listWrap}>
          <PluginList plugins={plugins} isLoading={isLoading} />
        </div>
        <RoadmapLinks />
        <UpdateAllModal
          isOpen={showUpdateModal}
          isLoading={areUpdatesLoading}
          onDismiss={() => setShowUpdateModal(false)}
          plugins={updatablePlugins}
        />
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actionBar: css({
    [theme.breakpoints.up('xl')]: {
      marginLeft: 'auto',
    },
  }),
  listWrap: css({
    marginTop: theme.spacing(2),
  }),
  displayAs: css({
    svg: {
      marginRight: 0,
    },
  }),
});
