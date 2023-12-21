import { debounce } from 'lodash';
import React, { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { TabbedContainer, TabConfig } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { SortOrder, RichHistorySearchFilters, RichHistorySettings } from 'app/core/utils/richHistory';
import { RichHistoryQuery } from 'app/types/explore';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';

import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistorySettingsTab } from './RichHistorySettingsTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';

export enum Tabs {
  RichHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

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
  updateHistorySearchFilters: (exploreId: string, filters: RichHistorySearchFilters) => void;
  loadRichHistory: (exploreId: string) => void;
  loadMoreRichHistory: (exploreId: string) => void;
  clearRichHistoryResults: (exploreId: string) => void;
  deleteRichHistory: () => void;
  activeDatasourceInstance: string;
  firstTab: Tabs;
  exploreId: string;
  height: number;
  onClose: () => void;
}

export function RichHistory(props: RichHistoryProps) {
  const {
    richHistory,
    richHistoryTotal,
    height,
    exploreId,
    deleteRichHistory,
    onClose,
    firstTab,
    activeDatasourceInstance,
  } = props;

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
    props.updateHistorySearchFilters(props.exploreId, filters);
    loadRichHistory();
  };

  const loadRichHistory = debounce(() => {
    props.loadRichHistory(props.exploreId);
    setLoading(true);
  }, 300);

  const onChangeRetentionPeriod = (retentionPeriod: SelectableValue<number>) => {
    if (retentionPeriod.value !== undefined) {
      updateSettings({ retentionPeriod: retentionPeriod.value });
    }
  };

  const toggleStarredTabAsFirstTab = () =>
    updateSettings({ starredTabAsFirstTab: !props.richHistorySettings.starredTabAsFirstTab });

  const toggleActiveDatasourceOnly = () =>
    updateSettings({ activeDatasourceOnly: !props.richHistorySettings.activeDatasourceOnly });

  useEffect(() => {
    setLoading(false);
  }, [richHistory]);

  const QueriesTab: TabConfig = {
    label: t('explore.rich-history.query-history', 'Query history'),
    value: Tabs.RichHistory,
    content: (
      <RichHistoryQueriesTab
        queries={richHistory}
        totalQueries={richHistoryTotal || 0}
        loading={loading}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults(props.exploreId)}
        loadMoreRichHistory={() => props.loadMoreRichHistory(props.exploreId)}
        activeDatasourceInstance={activeDatasourceInstance}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
        exploreId={exploreId}
        height={height}
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
        activeDatasourceInstance={activeDatasourceInstance}
        updateFilters={updateFilters}
        clearRichHistoryResults={() => props.clearRichHistoryResults(props.exploreId)}
        loadMoreRichHistory={() => props.loadMoreRichHistory(props.exploreId)}
        richHistorySettings={props.richHistorySettings}
        richHistorySearchFilters={props.richHistorySearchFilters}
        exploreId={exploreId}
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
        activeDatasourceOnly={props.richHistorySettings.activeDatasourceOnly}
        onChangeRetentionPeriod={onChangeRetentionPeriod}
        toggleStarredTabAsFirstTab={toggleStarredTabAsFirstTab}
        toggleactiveDatasourceOnly={toggleActiveDatasourceOnly}
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
    />
  );
}
