import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { TabsBar, Tab, TabContent, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { QueryHistorySettings } from './QueryHistorySettings';
import { QueryHistoryQueries } from './QueryHistoryQueries';
import { Resizable } from 're-resizable';

export enum Tabs {
  QueryHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export type SortingValue = 'Time ascending' | 'Time descending' | 'Datasource A-Z' | 'Datasource Z-A';

export type DataSourceOption = {
  value: string;
  label: string;
  imgUrl?: string;
};

interface QueryHistoryProps extends Themeable {
  width: number;
  isVisible: boolean;
}

interface QueryHistoryState {
  activeTab: Tabs;
  activeTimeSpan: string;
  activeStarredTab: boolean;
  showActiveDatasourceHistory: boolean;
  hiddenSessions: boolean;
  datasourceFilters: DataSourceOption[] | null;
  sortingValue: SortingValue;
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
      activeTimeSpan: '2 days',
      activeStarredTab: false,
      showActiveDatasourceHistory: true,
      hiddenSessions: true,
      datasourceFilters: null,
      sortingValue: 'Time ascending',
    };
  }

  onChangeActiveTimeSpan = (historyTimeSpan: { label: string; value: string }) =>
    this.setState({ activeTimeSpan: historyTimeSpan.value });

  onChangeSortingValue = (sortingValue: SortingValue) => this.setState({ sortingValue });

  toggleActiveStarredTab = () =>
    this.setState(state => {
      return {
        activeStarredTab: !state.activeStarredTab,
      };
    });

  toggleShowActiveDatasourceHistory = () =>
    this.setState(state => {
      return {
        showActiveDatasourceHistory: !state.showActiveDatasourceHistory,
      };
    });

  toggleHideSessions = () => {
    this.setState(state => {
      return {
        hiddenSessions: !state.hiddenSessions,
      };
    });
  };

  onSelectDatasourceFilters = (datasources: DataSourceOption[] | null) => {
    this.setState({ datasourceFilters: datasources });
  };

  onSelectTab = (item: SelectableValue<Tabs>) => {
    this.setState({ activeTab: item.value });
  };

  render() {
    const {
      activeTab,
      activeTimeSpan,
      activeStarredTab,
      showActiveDatasourceHistory,
      hiddenSessions,
      datasourceFilters,
      sortingValue,
    } = this.state;
    const { theme, isVisible, width } = this.props;
    const styles = getStyles(theme);

    const tabs = [];
    tabs.push({
      label: 'Query history',
      value: Tabs.QueryHistory,
      content: (
        <QueryHistoryQueries
          datasourceFilters={datasourceFilters}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
          queries={testData}
          onlyStarred={false}
          onChangeSortingValue={this.onChangeSortingValue}
          sortingValue={sortingValue}
        />
      ),
      icon: 'fa fa-history',
    });

    tabs.push({
      label: 'Starred',
      value: Tabs.Starred,
      content: (
        <QueryHistoryQueries
          queries={testData}
          onlyStarred={true}
          onChangeSortingValue={this.onChangeSortingValue}
          sortingValue={sortingValue}
        />
      ),
      icon: 'fa fa-star',
    });

    tabs.push({
      label: 'Settings',
      value: Tabs.Settings,
      content: (
        <QueryHistorySettings
          activeTimeSpan={activeTimeSpan}
          activeStarredTab={activeStarredTab}
          showActiveDatasourceHistory={showActiveDatasourceHistory}
          hiddenSessions={hiddenSessions}
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
QueryHistory.displayName = 'QueryHistory';

const testData = [
  {
    timestamp: 3,
    datasourceName: 'Loki_test',
    datasourceType: 'Prometheus',
    starred: false,
    comment: 'This is interesting1',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session',
    uid: 3,
  },
  {
    timestamp: 2,
    datasourceName: 'Prometheus',
    datasourceType: 'Prometheus',
    starred: true,
    comment: '',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session2',
    uid: 2,
  },
  {
    timestamp: 1,
    datasourceName: 'Loki',
    datasourceType: 'Prometheus',
    starred: true,
    comment: 'This is interesting3',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session',
    uid: 1,
  },
];
