import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { TabsBar, Tab, TabContent, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { QueryHistorySettings } from './QueryHistorySettings';
import { QueryHistoryQueries } from './QueryHistoryQueries';
import { Resizable } from 're-resizable';
import store from 'app/core/store';

export enum Tabs {
  QueryHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

const SETTINGS_KEYS = {
  activeTimeSpan: 'grafana.explore.queryHistory.activeTimeSpan',
  activeStarredTab: 'grafana.explore.queryHistory.activeStarredTab',
  showActiveDatasourceHistory: 'grafana.explore.queryHistory.showActiveDatasourceHistory',
  hiddenSession: 'grafana.explore.queryHistory.hiddenSession',
};

export type SortingValue = 'Time ascending' | 'Time descending' | 'Datasource A-Z' | 'Datasource Z-A';

export type DataSourceOption = {
  value: string;
  label: string;
  imgUrl?: string;
};

interface QueryHistoryProps extends Themeable {
  width: number;
  isVisible: boolean;
  queryHistory: any[];
  updateStarredQuery: (ts: number) => void;
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
      overflow-y: scroll;
    `,
    drawerActive: css`
      position: fixed !important;
      bottom: 0;
      background-color: ${tabBarBg};
      border: solid 1px ${borderColor};
      padding-left: ${theme.spacing.sm};
      padding-top: ${theme.spacing.xs};
      opacity: 1;
      transition: transform 0.3s ease-in;
    `,
    drawerNotActive: css`
      opacity: 0;
      transform: translateY(150px);
      position: fixed !important;
      bottom: 0;
    `,
    handle: css`
      background-color: ${borderColor};
      height: 10px;
      width: 202px;
      border-radius: 10px;
      position: absolute;
      top: -5px;
      left: calc(50% - 101px);
      padding: ${theme.spacing.xs};
      cursor: grab;
      hr {
        border-top: 2px dotted ${theme.colors.gray70};
        margin: 0;
      }
    `,
  };
});

class UnThemedQueryHistory extends PureComponent<QueryHistoryProps, QueryHistoryState> {
  constructor(props: QueryHistoryProps) {
    super(props);
    this.state = {
      activeTab: Tabs.QueryHistory,
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
    const { theme, isVisible, width, queryHistory, updateStarredQuery } = this.props;
    const styles = getStyles(theme);

    const tabs = [];
    tabs.push({
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
          updateStarredQuery={updateStarredQuery}
        />
      ),
      icon: 'fa fa-history',
    });

    tabs.push({
      label: 'Starred',
      value: Tabs.Starred,
      content: (
        <QueryHistoryQueries
          queries={queryHistory}
          onlyStarred={true}
          onChangeSortingValue={this.onChangeSortingValue}
          sortingValue={sortingValue}
          updateStarredQuery={updateStarredQuery}
        />
      ),
      icon: 'fa fa-star',
    });

    tabs.push({
      label: 'Settings',
      value: Tabs.Settings,
      content: (
        <QueryHistorySettings
          activeTimeSpan={this.state.activeTimeSpan}
          activeStarredTab={this.state.activeStarredTab}
          showActiveDatasourceHistory={this.state.showActiveDatasourceHistory}
          hiddenSessions={this.state.hiddenSession}
          onChangeActiveTimeSpan={this.onChangeActiveTimeSpan}
          toggleActiveStarredTab={this.toggleActiveStarredTab}
          toggleHideSessions={this.toggleHideSessions}
          toggleShowActiveDatasourceHistory={this.toggleShowActiveDatasourceHistory}
        />
      ),
      icon: 'gicon gicon-preferences',
    });
    return (
      <Resizable
        defaultSize={{ width, height: '300px' }}
        className={`${isVisible ? styles.drawerActive : styles.drawerNotActive} `}
        enable={{
          top: true,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
        maxHeight="100vh"
        maxWidth={`${width}px`}
        minWidth={`${width}px`}
      >
        <div className={styles.handle}>
          <hr />
        </div>
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
      </Resizable>
    );
  }
}

export const QueryHistory = withTheme(UnThemedQueryHistory);
