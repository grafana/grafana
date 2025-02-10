import { debounce } from 'lodash';
import { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TabbedContainer, TabConfig } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
  createDatasourcesList,
} from 'app/core/utils/richHistory';
import { useSelector } from 'app/types';
import { RichHistoryQuery } from 'app/types/explore';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { Tabs } from '../QueriesDrawer/QueriesDrawerContext';
import { i18n } from '../QueriesDrawer/utils';
import { selectExploreDSMaps } from '../state/selectors';

import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistorySettingsTab } from './RichHistorySettingsTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';

export const getSortOrderOptions = () =>
  [
    { label: t('explore.rich-history.newest-first', 'Newest first'), value: SortOrder.Descending },
    { label: t('explore.rich-history.oldest-first', 'Oldest first'), value: SortOrder.Ascending },
    { label: t('explore.rich-history.datasource-a-z', 'Data source A-Z'), value: SortOrder.DatasourceAZ },
    { label: t('explore.rich-history.datasource-z-a', 'Data source Z-A'), value: SortOrder.DatasourceZA },
  ].filter((option) => supportedFeatures().availableFilters.includes(option.value));

export interface RichHistoryProps {
  richHistory: RichHistoryQuery[];
  richHistoryTotal?: number;
  richHistorySettings: RichHistorySettings;
  richHistorySearchFilters?: RichHistorySearchFilters;
  updateHistorySettings: (settings: RichHistorySettings) => void;
  updateHistorySearchFilters: (filters: RichHistorySearchFilters) => void;
  loadRichHistory: () => void;
  loadMoreRichHistory: () => void;
  clearRichHistoryResults: () => void;
  deleteRichHistory: () => void;
  firstTab: Tabs;
  height: number;
  onClose: () => void;
}

export function RichHistory(props: RichHistoryProps) {
  const { richHistory, richHistoryTotal, height, deleteRichHistory, onClose, firstTab } = props;

  const [loading, setLoading] = useState(false);

  const updateSettings = (settingsToUpdate: Partial<RichHistorySettings>) => {
    props.updateHistorySettings({ ...props.richHistorySettings, ...settingsToUpdate });
  };

  const updateFilters = (filtersToUpdate?: Partial<RichHistorySearchFilters>) => {
    const filters = {
      ...props.richHistorySearchFilters!,
      ...filtersToUpdate,
      page: 1, // always load fresh results when updating filters
    };
    props.updateHistorySearchFilters(filters);
    loadRichHistory();
  };

  const loadRichHistory = debounce(() => {
    props.loadRichHistory();
    setLoading(true);
  }, 300);

  const onChangeRetentionPeriod = (retentionPeriod: SelectableValue<number>) => {
    if (retentionPeriod.value !== undefined) {
      updateSettings({ retentionPeriod: retentionPeriod.value });
    }
  };

  const toggleStarredTabAsFirstTab = () =>
    updateSettings({ starredTabAsFirstTab: !props.richHistorySettings.starredTabAsFirstTab });

  const toggleActiveDatasourcesOnly = () =>
    updateSettings({ activeDatasourcesOnly: !props.richHistorySettings.activeDatasourcesOnly });

  useEffect(() => {
    setLoading(false);
  }, [richHistory]);

  const exploreActiveDS = useSelector(selectExploreDSMaps);
  const listOfDatasources = createDatasourcesList();
  const activeDatasources = exploreActiveDS.dsToExplore
    .map((eDs) => listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name)
    .filter((name): name is string => !!name);

  const QueriesTab: TabConfig = {
    label: i18n.queryHistory,
    value: Tabs.RichHistory,
    content: (
      <RichHistoryQueriesTab
        queries={richHistory}
        totalQueries={richHistoryTotal || 0}
        loading={loading}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults()}
        loadMoreRichHistory={() => props.loadMoreRichHistory()}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
        height={height}
        activeDatasources={activeDatasources}
        listOfDatasources={listOfDatasources}
      />
    ),
    icon: 'history',
  };

  const StarredTab: TabConfig = {
    label: t('explore.rich-history.starred', 'Starred'),
    value: Tabs.Starred,
    content: (
      <RichHistoryStarredTab
        queries={richHistory}
        totalQueries={richHistoryTotal || 0}
        loading={loading}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults()}
        loadMoreRichHistory={() => props.loadMoreRichHistory()}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
      />
    ),
    icon: 'star',
  };

  const SettingsTab: TabConfig = {
    label: t('explore.rich-history.settings', 'Settings'),
    value: Tabs.Settings,
    content: (
      <RichHistorySettingsTab
        retentionPeriod={props.richHistorySettings.retentionPeriod}
        starredTabAsFirstTab={props.richHistorySettings.starredTabAsFirstTab}
        activeDatasourcesOnly={props.richHistorySettings.activeDatasourcesOnly}
        onChangeRetentionPeriod={onChangeRetentionPeriod}
        toggleStarredTabAsFirstTab={toggleStarredTabAsFirstTab}
        toggleActiveDatasourcesOnly={toggleActiveDatasourcesOnly}
        deleteRichHistory={deleteRichHistory}
      />
    ),
    icon: 'sliders-v-alt',
  };

  let tabs = [QueriesTab, StarredTab, SettingsTab];
  return (
    <TabbedContainer
      tabs={tabs}
      onClose={onClose}
      defaultTab={firstTab}
      closeIconTooltip={t('explore.rich-history.close-tooltip', 'Close query history')}
      testId={selectors.pages.Explore.QueryHistory.container}
    />
  );
}
