import React, { PureComponent } from 'react';

//Services & Utils
import { SortOrder } from 'app/core/utils/richHistory';
import { Themeable, withTheme, TabbedContainer, TabConfig } from '@grafana/ui';

//Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { SelectableValue } from '@grafana/data';

//Components
import { RichHistorySettingsTab } from './RichHistorySettingsTab';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';
import { RichHistorySearchFilters, RichHistorySettings } from '../../../core/utils/richHistoryTypes';

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
  richHistorySearchFilters: RichHistorySearchFilters;
  updateHistorySettings: (settings: RichHistorySettings) => void;
  updateHistorySearchFilters: (exploreId: ExploreId, filters: RichHistorySearchFilters) => void;
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

  updateFilters = (filtersToUpdate: Partial<RichHistorySearchFilters>) => {
    this.props.updateHistorySearchFilters(this.props.exploreId, {
      ...this.props.richHistorySearchFilters,
      ...filtersToUpdate,
    });
  };

  onChangeRetentionPeriod = (retentionPeriod: SelectableValue<number>) => {
    if (retentionPeriod.value !== undefined) {
      this.updateSettings({ retentionPeriod: retentionPeriod.value });
    }
  };

  toggleStarredTabAsFirstTab = () =>
    this.updateSettings({ starredTabAsFirstTab: !this.props.richHistorySettings.starredTabAsFirstTab });

  toggleActiveDatasourceOnly = () =>
    this.updateSettings({ activeDatasourceOnly: !this.props.richHistorySettings.activeDatasourceOnly });

  onSelectDatasourceFilters = (datasourceFilters: SelectableValue[]) => this.updateFilters({ datasourceFilters });

  onChangeSortOrder = (sortOrder: SortOrder) => this.updateFilters({ sortOrder });

  /* If user selects activeDatasourceOnly === true, set datasource filter to currently active datasource.
   * Filtering based on datasource won't be available. Otherwise set to null, as filtering will be
   * available for user.
   */
  initFilters() {
    if (this.props.richHistorySettings.activeDatasourceOnly && this.props.activeDatasourceInstance) {
      this.onSelectDatasourceFilters([
        { label: this.props.activeDatasourceInstance, value: this.props.activeDatasourceInstance },
      ]);
    }
  }

  componentDidMount() {
    this.initFilters();
  }

  /**
   * Updating filters on didMount and didUpdate because we don't know when activeDatasourceInstance is ready
   */
  componentDidUpdate(prevProps: RichHistoryProps) {
    if (this.props.activeDatasourceInstance !== prevProps.activeDatasourceInstance) {
      this.initFilters();
    }
  }

  render() {
    const { activeDatasourceOnly, retentionPeriod } = this.props.richHistorySettings;
    const { datasourceFilters, sortOrder } = this.props.richHistorySearchFilters;
    const { richHistory, height, exploreId, deleteRichHistory, onClose, firstTab } = this.props;

    const QueriesTab: TabConfig = {
      label: 'Query history',
      value: Tabs.RichHistory,
      content: (
        <RichHistoryQueriesTab
          queries={richHistory}
          sortOrder={sortOrder}
          datasourceFilters={datasourceFilters}
          activeDatasourceOnly={activeDatasourceOnly}
          retentionPeriod={retentionPeriod}
          onChangeSortOrder={this.onChangeSortOrder}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
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
          sortOrder={sortOrder}
          datasourceFilters={datasourceFilters}
          activeDatasourceOnly={activeDatasourceOnly}
          onChangeSortOrder={this.onChangeSortOrder}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
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
