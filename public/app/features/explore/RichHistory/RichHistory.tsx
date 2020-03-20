import React, { PureComponent } from 'react';
import { css } from 'emotion';

//Services & Utils
import { SortOrder } from 'app/core/utils/explore';
import { RICH_HISTORY_SETTING_KEYS } from 'app/core/utils/richHistory';
import store from 'app/core/store';
import { stylesFactory, withTheme } from '@grafana/ui';

//Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { TabsBar, Tab, TabContent, Themeable, CustomScrollbar } from '@grafana/ui';

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
  { label: 'Time ascending', value: SortOrder.Ascending },
  { label: 'Time descending', value: SortOrder.Descending },
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
  activeTab: Tabs;
  sortOrder: SortOrder;
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  datasourceFilters: SelectableValue[] | null;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  const tabBarBg = theme.isLight ? theme.colors.white : theme.colors.black;
  const tabContentBg = theme.isLight ? theme.colors.gray7 : theme.colors.dark2;
  return {
    container: css`
      height: 100%;
      background-color: ${tabContentBg};
    `,
    tabContent: css`
      background-color: ${tabContentBg};
      padding: ${theme.spacing.md};
    `,
    close: css`
      position: absolute;
      right: ${theme.spacing.sm};
      cursor: pointer;
    `,
    tabs: css`
      background-color: ${tabBarBg};
      padding-top: ${theme.spacing.sm};
      border-color: ${borderColor};
      ul {
        margin-left: ${theme.spacing.md};
      }
    `,
  };
});

class UnThemedRichHistory extends PureComponent<RichHistoryProps, RichHistoryState> {
  constructor(props: RichHistoryProps) {
    super(props);
    this.state = {
      activeTab: this.props.firstTab,
      sortOrder: SortOrder.Descending,
      datasourceFilters: store.getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, null),
      retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
      starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
      activeDatasourceOnly: store.getBool(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, false),
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

  toggleactiveDatasourceOnly = () => {
    const activeDatasourceOnly = !this.state.activeDatasourceOnly;
    this.setState({
      activeDatasourceOnly,
    });
    store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, activeDatasourceOnly);
  };

  onSelectDatasourceFilters = (value: SelectableValue[] | null) => {
    store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, value);
    this.setState({ datasourceFilters: value });
  };

  onSelectTab = (item: SelectableValue<Tabs>) => {
    this.setState({ activeTab: item.value! });
  };

  onChangeSortOrder = (sortOrder: SortOrder) => this.setState({ sortOrder });

  /* If user selects activeDatasourceOnly === true, set datasource filter to currently active datasource.
   *  Filtering based on datasource won't be available. Otherwise set to null, as filtering will be
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
    const { datasourceFilters, sortOrder, activeTab, activeDatasourceOnly, retentionPeriod } = this.state;
    const { theme, richHistory, height, exploreId, deleteRichHistory, onClose } = this.props;
    const styles = getStyles(theme);

    const QueriesTab = {
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
      icon: 'fa fa-history',
    };

    const StarredTab = {
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
      icon: 'fa fa-star',
    };

    const SettingsTab = {
      label: 'Settings',
      value: Tabs.Settings,
      content: (
        <RichHistorySettings
          retentionPeriod={this.state.retentionPeriod}
          starredTabAsFirstTab={this.state.starredTabAsFirstTab}
          activeDatasourceOnly={this.state.activeDatasourceOnly}
          onChangeRetentionPeriod={this.onChangeRetentionPeriod}
          toggleStarredTabAsFirstTab={this.toggleStarredTabAsFirstTab}
          toggleactiveDatasourceOnly={this.toggleactiveDatasourceOnly}
          deleteRichHistory={deleteRichHistory}
        />
      ),
      icon: 'gicon gicon-preferences',
    };

    let tabs = [QueriesTab, StarredTab, SettingsTab];
    return (
      <div className={styles.container}>
        <TabsBar className={styles.tabs}>
          {tabs.map(t => (
            <Tab
              key={t.value}
              label={t.label}
              active={t.value === activeTab}
              onChangeTab={() => this.onSelectTab(t)}
              icon={t.icon}
            />
          ))}
          <div className={styles.close} onClick={onClose}>
            <i className="fa fa-times" title="Close query history" />
          </div>
        </TabsBar>
        <CustomScrollbar
          className={css`
            min-height: 100% !important;
          `}
        >
          <TabContent className={styles.tabContent}>{tabs.find(t => t.value === activeTab)?.content}</TabContent>
        </CustomScrollbar>
      </div>
    );
  }
}

export const RichHistory = withTheme(UnThemedRichHistory);
