import { debounce } from 'lodash';
import { useState, useMemo, useRef } from 'react';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { TabbedContainer, type TabConfig } from '@grafana/ui';
import { SortOrder, type RichHistorySearchFilters, type RichHistorySettings } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';
import { useSelector } from 'app/types/store';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { Tabs } from '../QueriesDrawer/QueriesDrawerContext';
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
  loadRichHistory: () => Promise<void>;
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
  const [loadError, setLoadError] = useState(false);

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

  // Sequences concurrent loads so a stale resolution can't overwrite state that
  // belongs to a newer request: an older rejection settling after a newer load,
  // or an older success clearing an error raised by the latest filter change.
  const latestLoadId = useRef(0);

  const loadRichHistory = debounce(() => {
    const loadId = ++latestLoadId.current;
    setLoading(true);
    setLoadError(false);
    props.loadRichHistory().then(
      () => {
        if (loadId === latestLoadId.current) {
          setLoading(false);
        }
      },
      () => {
        if (loadId === latestLoadId.current) {
          setLoading(false);
          setLoadError(true);
        }
      }
    );
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

  const exploreActiveDS = useSelector(selectExploreDSMaps);
  const {
    items: dataSourceItems,
    isLoading: isLoadingDatasources,
    error: dsListError,
  } = useDataSourceInstanceList({ mixed: true });
  const listOfDatasources = useMemo(
    () => dataSourceItems.map((ds) => ({ name: ds.name, uid: ds.uid })),
    [dataSourceItems]
  );
  const activeDatasources = exploreActiveDS.dsToExplore
    .map((eDs) => listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name)
    .filter((name): name is string => !!name);

  const QueriesTab: TabConfig = {
    label: t('explore.rich-history.query-history', 'Query history'),
    value: Tabs.RichHistory,
    content: (
      <RichHistoryQueriesTab
        queries={richHistory}
        totalQueries={richHistoryTotal || 0}
        loading={loading}
        loadError={loadError}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults()}
        loadMoreRichHistory={() => props.loadMoreRichHistory()}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
        height={height}
        activeDatasources={activeDatasources}
        listOfDatasources={listOfDatasources}
        isLoadingDatasources={isLoadingDatasources}
        dsListError={!!dsListError}
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
        loadError={loadError}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults()}
        loadMoreRichHistory={() => props.loadMoreRichHistory()}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
        activeDatasources={activeDatasources}
        listOfDatasources={listOfDatasources}
        isLoadingDatasources={isLoadingDatasources}
        dsListError={!!dsListError}
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
