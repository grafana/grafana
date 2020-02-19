import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { TabsBar, Tab, TabContent, stylesFactory, withTheme, Themeable } from '@grafana/ui';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { QueryHistorySettings } from './QueryHistorySettings';
import { QueryHistoryQueries } from './QueryHistoryQueries';

export enum Tabs {
  QueryHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export type DataSourceOption = {
  value: string;
  label: string;
  imgUrl?: string;
};

interface QueryHistoryProps extends Themeable {
  width: any;
}

interface QueryHistoryState {
  activeTab: Tabs;
  activeTimeSpan: string;
  activeStarredTab: boolean;
  showActiveDatasourceHistory: boolean;
  hiddenSessions: boolean;
  datasources: DataSourceOption[] | null;
  height: number;
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
    drawer: css`
      position: fixed;
      bottom: 0;
      background-color: ${tabBarBg};
      border: solid 1px ${borderColor};
      padding-left: ${theme.spacing.sm};
      padding-top: ${theme.spacing.xs};
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
      datasources: null,
      height: 400,
    };
  }

  onChangeActiveTimeSpan = (historyTimeSpan: { label: string; value: string }) =>
    this.setState({ activeTimeSpan: historyTimeSpan.value });

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

  onSelectDatasources = (datasources: DataSourceOption[] | null) => {
    this.setState({ datasources });
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
      datasources,
      height,
    } = this.state;
    const { width, theme } = this.props;
    const styles = getStyles(theme);

    const tabs = [];
    tabs.push({
      label: 'Query history',
      value: Tabs.QueryHistory,
      content: (
        <QueryHistoryQueries
          datasources={datasources}
          onSelectDatasources={this.onSelectDatasources}
          queries={testData}
        />
      ),
      icon: 'fa fa-history',
    });
    tabs.push({
      label: 'Starred',
      value: Tabs.Starred,
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
      <div className={styles.drawer} style={{ width, height }}>
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
QueryHistory.displayName = 'QueryHistory';

const testData = [
  {
    timestamp: 1,
    datasourceName: 'Prometheus1',
    datasourceType: 'Prometheus',
    starred: true,
    comment: 'This is interesting',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session',
  },
  {
    timestamp: 1,
    datasourceName: 'Prometheus1',
    datasourceType: 'Prometheus',
    starred: true,
    comment: '',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session',
  },
  {
    timestamp: 1,
    datasourceName: 'Prometheus1',
    datasourceType: 'Prometheus',
    starred: true,
    comment: 'This is interesting',
    queries: [
      `rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
      `prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}`,
    ],
    sessionName: 'Custom name for this session',
  },
];
