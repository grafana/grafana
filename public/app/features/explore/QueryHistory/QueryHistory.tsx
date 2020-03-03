import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { TabsBar, Tab, TabContent, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { QueryHistorySettings } from './QueryHistorySettings';
import { QueryHistoryContent, DataSourceOption } from './QueryHistoryContent';
import store from 'app/core/store';
import { SortOrder } from 'app/core/utils/explore';
import { QueryHistoryQuery } from 'app/types/explore';

export enum Tabs {
  QueryHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export const SETTINGS_KEYS = {
  activeTimeSpan: 'grafana.explore.queryHistory.activeTimeSpan',
  activeStarredTab: 'grafana.explore.queryHistory.activeStarredTab',
  onlyActiveDatasourceHistory: 'grafana.explore.queryHistory.onlyActiveDatasourceHistory',
  hiddenSession: 'grafana.explore.queryHistory.hiddenSession',
};

interface QueryHistoryProps extends Themeable {
  queryHistory: QueryHistoryQuery[];
  firstTab: Tabs;
  activeDatasourceInstance: string;
  onChangeQueryHistoryProperty: (ts: number, property: string) => void;
}

interface QueryHistoryState {
  activeTab: Tabs;
  datasourceFilters: DataSourceOption[] | null;
  sortOrder: SortOrder;
  activeTimeSpan: number;
  activeStarredTab: boolean;
  onlyActiveDatasourceHistory: boolean;
  hiddenSession: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  const tabBarBg = theme.isLight ? theme.colors.white : theme.colors.black;
  const tabContentBg = theme.isLight ? theme.colors.gray7 : theme.colors.dark2;
  return {
    container: css`
      height: 100%;
      overflow-y: scroll;
      background-color: ${tabContentBg};
    `,
    tabContent: css`
      background-color: ${tabContentBg};
      border-top: solid 1px ${borderColor};
      padding: ${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.md};
    `,
    tabs: css`
      background-color: ${tabBarBg};
      padding-top: ${theme.spacing.sm};
      ul {
        margin-left: ${theme.spacing.md};
      }
    `,
  };
});

class UnThemedQueryHistory extends PureComponent<QueryHistoryProps, QueryHistoryState> {
  constructor(props: QueryHistoryProps) {
    super(props);
    this.state = {
      activeTab: this.props.firstTab,
      datasourceFilters: null,
      sortOrder: SortOrder.Descending,
      activeTimeSpan: store.getObject(SETTINGS_KEYS.activeTimeSpan, 2),
      activeStarredTab: store.getBool(SETTINGS_KEYS.activeStarredTab, false),
      onlyActiveDatasourceHistory: store.getBool(SETTINGS_KEYS.onlyActiveDatasourceHistory, false),
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

  toggleonlyActiveDatasourceHistory = () => {
    const onlyActiveDatasourceHistory = !this.state.onlyActiveDatasourceHistory;
    this.setState({
      onlyActiveDatasourceHistory,
    });
    store.set(SETTINGS_KEYS.onlyActiveDatasourceHistory, onlyActiveDatasourceHistory);
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

  onChangeSortOrder = (sortOrder: SortOrder) => this.setState({ sortOrder });

  render() {
    const {
      datasourceFilters,
      sortOrder,
      activeTab,
      activeStarredTab,
      onlyActiveDatasourceHistory,
      activeTimeSpan,
    } = this.state;
    const { theme, queryHistory, onChangeQueryHistoryProperty, activeDatasourceInstance } = this.props;
    const styles = getStyles(theme);

    const QueriesTab = {
      label: 'Query history',
      value: Tabs.QueryHistory,
      content: (
        <QueryHistoryContent
          queries={queryHistory}
          onlyStarred={false}
          onChangeSortOrder={this.onChangeSortOrder}
          sortOrder={sortOrder}
          onChangeQueryHistoryProperty={onChangeQueryHistoryProperty}
          datasourceFilters={datasourceFilters}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
          onlyActiveDatasourceHistory={onlyActiveDatasourceHistory}
          activeDatasourceInstance={activeDatasourceInstance}
          activeTimeSpan={activeTimeSpan}
        />
      ),
      icon: 'fa fa-history',
    };

    const StarredTab = {
      label: 'Starred',
      value: Tabs.Starred,
      content: (
        <QueryHistoryContent
          queries={queryHistory}
          onlyStarred={true}
          onChangeSortOrder={this.onChangeSortOrder}
          sortOrder={sortOrder}
          onChangeQueryHistoryProperty={onChangeQueryHistoryProperty}
          onlyActiveDatasourceHistory={onlyActiveDatasourceHistory}
          activeDatasourceInstance={activeDatasourceInstance}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
          datasourceFilters={datasourceFilters}
          activeTimeSpan={activeTimeSpan}
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
          onlyActiveDatasourceHistory={this.state.onlyActiveDatasourceHistory}
          onChangeActiveTimeSpan={this.onChangeActiveTimeSpan}
          toggleActiveStarredTab={this.toggleActiveStarredTab}
          toggleHideSessions={this.toggleHideSessions}
          toggleonlyActiveDatasourceHistory={this.toggleonlyActiveDatasourceHistory}
        />
      ),
      icon: 'gicon gicon-preferences',
    };

    const tabs = [];
    tabs.push(QueriesTab);
    tabs.push(SettingsTab);
    tabs.splice(activeStarredTab ? 0 : 1, 0, StarredTab);

    return (
      <div className={styles.container}>
        <TabsBar className={styles.tabs} hideBorder={true}>
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
