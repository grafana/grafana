import React, { PureComponent } from 'react';

//Services & Utils
import { RICH_HISTORY_SETTING_KEYS, SortOrder } from 'app/core/utils/richHistory';
import store from 'app/core/store';
import { withTheme, TabbedContainer, TabConfig } from '@grafana/ui';

//Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { SelectableValue } from '@grafana/data';
import { Themeable } from '@grafana/ui';

//Components
import { RichHistorySettings } from './RichHistorySettings';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
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
  activeDatasourceInstance: string;
  firstTab: Tabs;
  exploreId: ExploreId;
  height: number;
  deleteRichHistory: () => void;
  onClose: () => void;
}

interface RichHistoryState {
  sortOrder: SortOrder;
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  datasourceFilters: SelectableValue[] | null;
}

class UnThemedRichHistory extends PureComponent<RichHistoryProps, RichHistoryState> {
  constructor(props: RichHistoryProps) {
    super(props);
    this.state = {
      sortOrder: SortOrder.Descending,
      datasourceFilters: store.getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, null),
      retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
      starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
      activeDatasourceOnly: store.getBool(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, true),
    };
  }

  onChangeRetentionPeriod = (retentionPeriod: { label: string; value: number }) => {
    this.setState({
      retentionPeriod: retentionPeriod.value,
    });
    store.set(RICH_HISTORY_SETTING_KEYS.retentionPeriod, retentionPeriod.value);
  };

  toggleStarredTabAsFirstTab = () => {
    const starredTabAsFirstTab = !this.state.starredTabAsFirstTab;
    this.setState({
      starredTabAsFirstTab,
    });
    store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, starredTabAsFirstTab);
  };

  toggleActiveDatasourceOnly = () => {
    const activeDatasourceOnly = !this.state.activeDatasourceOnly;
    this.setState({
      activeDatasourceOnly,
    });
    store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, activeDatasourceOnly);
  };

  onSelectDatasourceFilters = (value: SelectableValue[] | null) => {
    try {
      store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, value);
    } catch (error) {
      console.error(error);
    }
    /* Set data source filters to state even though they were not successfully saved in
     * localStorage to allow interaction and filtering.
     **/
    this.setState({ datasourceFilters: value });
  };

  onChangeSortOrder = (sortOrder: SortOrder) => this.setState({ sortOrder });

  /* If user selects activeDatasourceOnly === true, set datasource filter to currently active datasource.
   * Filtering based on datasource won't be available. Otherwise set to null, as filtering will be
   * available for user.
   */
  updateFilters() {
    this.state.activeDatasourceOnly && this.props.activeDatasourceInstance
      ? this.onSelectDatasourceFilters([
          { label: this.props.activeDatasourceInstance, value: this.props.activeDatasourceInstance },
        ])
      : this.onSelectDatasourceFilters(this.state.datasourceFilters);
  }

  componentDidMount() {
    this.updateFilters();
  }

  componentDidUpdate(prevProps: RichHistoryProps, prevState: RichHistoryState) {
    if (
      this.props.activeDatasourceInstance !== prevProps.activeDatasourceInstance ||
      this.state.activeDatasourceOnly !== prevState.activeDatasourceOnly
    ) {
      this.updateFilters();
    }
  }

  render() {
    const { datasourceFilters, sortOrder, activeDatasourceOnly, retentionPeriod } = this.state;
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
        <RichHistorySettings
          retentionPeriod={this.state.retentionPeriod}
          starredTabAsFirstTab={this.state.starredTabAsFirstTab}
          activeDatasourceOnly={this.state.activeDatasourceOnly}
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
