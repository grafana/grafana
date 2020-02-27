import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { TabsBar, Tab, TabContent, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { QueryHistorySettings } from './QueryHistorySettings';
import { QueryHistoryQueries, SortingValue, DataSourceOption } from './QueryHistoryQueries';
import store from 'app/core/store';

export enum Tabs {
  QueryHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export const SETTINGS_KEYS = {
  activeTimeSpan: 'grafana.explore.queryHistory.activeTimeSpan',
  activeStarredTab: 'grafana.explore.queryHistory.activeStarredTab',
  showActiveDatasourceHistory: 'grafana.explore.queryHistory.showActiveDatasourceHistory',
  hiddenSession: 'grafana.explore.queryHistory.hiddenSession',
};

interface QueryHistoryProps extends Themeable {
  queryHistory: any[];
  onChangeQueryHistoryProperty: (ts: number, property: string) => void;
  firstTab: Tabs;
}

interface QueryHistoryState {
  activeTab: Tabs;
  datasourceFilters: DataSourceOption[] | null;
  sortingValue: SortingValue;
  activeTimeSpan: number;
  activeStarredTab: boolean;
  showActiveDatasourceHistory: boolean;
  hiddenSession: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  const tabBarBg = theme.isLight ? theme.colors.white : theme.colors.black;
  const tabContentBg = theme.isLight ? theme.colors.gray7 : theme.colors.dark2;
  return {
    tabContent: css`
      height: calc(100% - ${theme.spacing.lg});
      width: calc(100% + ${theme.spacing.sm});
      background-color: ${tabContentBg};
      margin-left: -${theme.spacing.sm};
      padding: ${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.sm};
      border-top: solid 1px ${borderColor};
    `,
    container: css`
      background-color: ${tabBarBg};
      padding-left: ${theme.spacing.sm};
      padding-top: ${theme.spacing.xs};
      height: 100%;
      overflow-y: scroll;
    `,
  };
});

class UnThemedQueryHistory extends PureComponent<QueryHistoryProps, QueryHistoryState> {
  constructor(props: QueryHistoryProps) {
    super(props);
    this.state = {
      activeTab: this.props.firstTab,
      datasourceFilters: null,
      sortingValue: 'Time descending',
      activeTimeSpan: store.getObject(SETTINGS_KEYS.activeTimeSpan, 2),
      activeStarredTab: store.getBool(SETTINGS_KEYS.activeStarredTab, false),
      showActiveDatasourceHistory: store.getBool(SETTINGS_KEYS.showActiveDatasourceHistory, false),
      hiddenSession: store.getBool(SETTINGS_KEYS.hiddenSession, false),
    };
  }

  onChangeActiveTimeSpan = (historyTimeSpan: { label: string; value: number }) => {
    this.setState({
      activeTimeSpan: historyTimeSpan.value,
    });
    store.set(SETTINGS_KEYS.activeTimeSpan, historyTimeSpan.value);
  };

  toggleActiveStarredTab = () => {
    const activeStarredTab = !this.state.activeStarredTab;
    this.setState({
      activeStarredTab,
    });
    store.set(SETTINGS_KEYS.activeStarredTab, activeStarredTab);
  };

  toggleShowActiveDatasourceHistory = () => {
    const showActiveDatasourceHistory = !this.state.showActiveDatasourceHistory;
    this.setState({
      showActiveDatasourceHistory,
    });
    store.set(SETTINGS_KEYS.showActiveDatasourceHistory, showActiveDatasourceHistory);
  };

  toggleHideSessions = () => {
    const hiddenSession = !this.state.hiddenSession;
    this.setState({
      hiddenSession,
    });
    store.set(SETTINGS_KEYS.hiddenSession, hiddenSession);
  };

  onSelectDatasourceFilters = (datasources: DataSourceOption[] | null) => {
    this.setState({ datasourceFilters: datasources });
  };

  onSelectTab = (item: SelectableValue<Tabs>) => {
    this.setState({ activeTab: item.value });
  };

  onChangeSortingValue = (sortingValue: SortingValue) => this.setState({ sortingValue });

  render() {
    const { datasourceFilters, sortingValue, activeTab } = this.state;
    const { theme, queryHistory, onChangeQueryHistoryProperty } = this.props;
    const styles = getStyles(theme);

    const QueriesTab = {
      label: 'Query history',
      value: Tabs.QueryHistory,
      content: (
        <QueryHistoryQueries
          datasourceFilters={datasourceFilters}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
          queries={queryHistory}
          onlyStarred={false}
          onChangeSortingValue={this.onChangeSortingValue}
          sortingValue={sortingValue}
          onChangeQueryHistoryProperty={onChangeQueryHistoryProperty}
        />
      ),
      icon: 'fa fa-history',
    };

    const StarredTab = {
      label: 'Starred',
      value: Tabs.Starred,
      content: (
        <QueryHistoryQueries
          queries={queryHistory}
          onlyStarred={true}
          onChangeSortingValue={this.onChangeSortingValue}
          sortingValue={sortingValue}
          onChangeQueryHistoryProperty={onChangeQueryHistoryProperty}
        />
      ),
      icon: 'fa fa-star',
    };

    const SettingsTab = {
      label: 'Settings',
      value: Tabs.Settings,
      content: (
        <QueryHistorySettings
          activeTimeSpan={this.state.activeTimeSpan}
          activeStarredTab={this.state.activeStarredTab}
          hiddenSessions={this.state.hiddenSession}
          showActiveDatasourceHistory={this.state.showActiveDatasourceHistory}
          onChangeActiveTimeSpan={this.onChangeActiveTimeSpan}
          toggleActiveStarredTab={this.toggleActiveStarredTab}
          toggleHideSessions={this.toggleHideSessions}
          toggleShowActiveDatasourceHistory={this.toggleShowActiveDatasourceHistory}
        />
      ),
      icon: 'gicon gicon-preferences',
    };

    const tabs = [];

    if (this.state.activeStarredTab) {
      tabs.push(StarredTab);
      tabs.push(QueriesTab);
    } else {
      tabs.push(QueriesTab);
      tabs.push(StarredTab);
    }
    tabs.push(SettingsTab);

    return (
      <div className={styles.container}>
        <TabsBar hideBorder={true}>
          {tabs.map(t => (
            <Tab
              key={t.value}
              label={t.label}
              active={t.value === activeTab}
              onChangeTab={() => this.onSelectTab(t)}
              icon={t.icon}
            />
          ))}
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {tabs
            .filter(t => t.value === activeTab)
            .map(t => (
              <div key={t.label}>{t.content}</div>
            ))}
        </TabContent>
      </div>
    );
  }
}

export const QueryHistory = withTheme(UnThemedQueryHistory);
