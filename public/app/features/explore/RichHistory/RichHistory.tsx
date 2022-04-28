import { debounce } from 'lodash';
import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Themeable, withTheme, TabbedContainer, TabConfig } from '@grafana/ui';
import { SortOrder, RichHistorySearchFilters, RichHistorySettings } from 'app/core/utils/richHistory';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistorySettingsTab } from './RichHistorySettingsTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';

export enum Tabs {
  RichHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export const sortOrderOptions = [
  { label: 'Newest first', value: SortOrder.Descending },
  { label: 'Oldest first', value: SortOrder.Ascending },
  { label: 'Data source A-Z', value: SortOrder.DatasourceAZ },
  { label: 'Data source Z-A', value: SortOrder.DatasourceZA },
];

export interface RichHistoryProps extends Themeable {
  richHistory: RichHistoryQuery[];
  richHistorySettings: RichHistorySettings;
  richHistorySearchFilters?: RichHistorySearchFilters;
  updateHistorySettings: (settings: RichHistorySettings) => void;
  updateHistorySearchFilters: (exploreId: ExploreId, filters: RichHistorySearchFilters) => void;
  loadRichHistory: (exploreId: ExploreId) => void;
  clearRichHistoryResults: (exploreId: ExploreId) => void;
  deleteRichHistory: () => void;
  activeDatasourceInstance?: string;
  firstTab: Tabs;
  exploreId: ExploreId;
  height: number;
  onClose: () => void;
}

class UnThemedRichHistory extends PureComponent<RichHistoryProps> {
  updateSettings = (settingsToUpdate: Partial<RichHistorySettings>) => {
    this.props.updateHistorySettings({ ...this.props.richHistorySettings, ...settingsToUpdate });
  };

  updateFilters = (filtersToUpdate?: Partial<RichHistorySearchFilters>) => {
    const filters = {
      ...this.props.richHistorySearchFilters!,
      ...filtersToUpdate,
    };
    this.props.updateHistorySearchFilters(this.props.exploreId, filters);
    this.loadRichHistory();
  };

  clearResults = () => {
    this.props.clearRichHistoryResults(this.props.exploreId);
  };

  loadRichHistory = debounce(() => {
    this.props.loadRichHistory(this.props.exploreId);
  }, 300);

  onChangeRetentionPeriod = (retentionPeriod: SelectableValue<number>) => {
    if (retentionPeriod.value !== undefined) {
      this.updateSettings({ retentionPeriod: retentionPeriod.value });
    }
  };

  toggleStarredTabAsFirstTab = () =>
    this.updateSettings({ starredTabAsFirstTab: !this.props.richHistorySettings.starredTabAsFirstTab });

  toggleActiveDatasourceOnly = () =>
    this.updateSettings({ activeDatasourceOnly: !this.props.richHistorySettings.activeDatasourceOnly });

  render() {
    const { richHistory, height, exploreId, deleteRichHistory, onClose, firstTab, activeDatasourceInstance } =
      this.props;

    const QueriesTab: TabConfig = {
      label: 'Query history',
      value: Tabs.RichHistory,
      content: (
        <RichHistoryQueriesTab
          queries={richHistory}
          updateFilters={this.updateFilters}
          clearRichHistoryResults={() => this.props.clearRichHistoryResults(this.props.exploreId)}
          activeDatasourceInstance={activeDatasourceInstance}
          richHistorySettings={this.props.richHistorySettings}
          richHistorySearchFilters={this.props.richHistorySearchFilters}
          exploreId={exploreId}
          height={height}
        />
      ),
      icon: 'history',
    };

    const StarredTab: TabConfig = {
      label: 'Starred',
      value: Tabs.Starred,
      content: (
        <RichHistoryStarredTab
          queries={richHistory}
          activeDatasourceInstance={activeDatasourceInstance}
          updateFilters={this.updateFilters}
          clearRichHistoryResults={() => this.props.clearRichHistoryResults(this.props.exploreId)}
          richHistorySettings={this.props.richHistorySettings}
          richHistorySearchFilters={this.props.richHistorySearchFilters}
          exploreId={exploreId}
        />
      ),
      icon: 'star',
    };

    const SettingsTab: TabConfig = {
      label: 'Settings',
      value: Tabs.Settings,
      content: (
        <RichHistorySettingsTab
          retentionPeriod={this.props.richHistorySettings.retentionPeriod}
          starredTabAsFirstTab={this.props.richHistorySettings.starredTabAsFirstTab}
          activeDatasourceOnly={this.props.richHistorySettings.activeDatasourceOnly}
          onChangeRetentionPeriod={this.onChangeRetentionPeriod}
          toggleStarredTabAsFirstTab={this.toggleStarredTabAsFirstTab}
          toggleactiveDatasourceOnly={this.toggleActiveDatasourceOnly}
          deleteRichHistory={deleteRichHistory}
        />
      ),
      icon: 'sliders-v-alt',
    };

    let tabs = [QueriesTab, StarredTab, SettingsTab];
    return (
      <TabbedContainer tabs={tabs} onClose={onClose} defaultTab={firstTab} closeIconTooltip="Close query history" />
    );
  }
}

export const RichHistory = withTheme(UnThemedRichHistory);
