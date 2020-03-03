import React, { PureComponent } from 'react';
import { css } from 'emotion';

//Services & Utils
import { SortOrder } from 'app/core/utils/explore';
import store from 'app/core/store';
import { stylesFactory, withTheme } from '@grafana/ui';

//Types
import { RichHistoryQuery } from 'app/types/explore';
import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { TabsBar, Tab, TabContent, Themeable } from '@grafana/ui';

//Components
import { RichHistorySettings } from './RichHistorySettings';
import { RichHistoryContent, DataSourceOption } from './RichHistoryContent';

export enum Tabs {
  RichHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

export const RICH_HISTORY_SETTING_KEYS = {
  retentionPeriod: 'grafana.explore.richHistory.retentionPeriod',
  starredTabAsFirstTab: 'grafana.explore.richHistory.starredTabAsFirstTab',
  activeDatasourceOnly: 'grafana.explore.richHistory.activeDatasourceOnly',
};

interface RichHistoryProps extends Themeable {
  richHistory: RichHistoryQuery[];
  activeDatasourceInstance: string;
  firstTab: Tabs;
  onChangeRichHistoryProperty: (ts: number, property: string, updatedProperty?: string) => void;
}

interface RichHistoryState {
  activeTab: Tabs;
  sortOrder: SortOrder;
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  datasourceFilters: DataSourceOption[] | null;
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

class UnThemedRichHistory extends PureComponent<RichHistoryProps, RichHistoryState> {
  constructor(props: RichHistoryProps) {
    super(props);
    this.state = {
      activeTab: this.props.firstTab,
      datasourceFilters: null,
      sortOrder: SortOrder.Descending,
      retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 2),
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
      starredTabAsFirstTab,
      activeDatasourceOnly,
      retentionPeriod,
    } = this.state;
    const { theme, richHistory, onChangeRichHistoryProperty, activeDatasourceInstance } = this.props;
    const styles = getStyles(theme);

    const QueriesTab = {
      label: Tabs.RichHistory,
      value: Tabs.RichHistory,
      content: (
        <RichHistoryContent
          queries={richHistory}
          sortOrder={sortOrder}
          datasourceFilters={datasourceFilters}
          activeDatasourceOnly={activeDatasourceOnly}
          activeDatasourceInstance={activeDatasourceInstance}
          retentionPeriod={retentionPeriod}
          onChangeSortOrder={this.onChangeSortOrder}
          onChangeRichHistoryProperty={onChangeRichHistoryProperty}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
        />
      ),
      icon: 'fa fa-history',
    };

    const StarredTab = {
      label: Tabs.Starred,
      value: Tabs.Starred,
      content: (
        <RichHistoryContent
          onlyStarred={true}
          queries={richHistory}
          sortOrder={sortOrder}
          datasourceFilters={datasourceFilters}
          activeDatasourceOnly={activeDatasourceOnly}
          activeDatasourceInstance={activeDatasourceInstance}
          onChangeSortOrder={this.onChangeSortOrder}
          onChangeRichHistoryProperty={onChangeRichHistoryProperty}
          onSelectDatasourceFilters={this.onSelectDatasourceFilters}
        />
      ),
      icon: 'fa fa-star',
    };

    const SettingsTab = {
      label: Tabs.Settings,
      value: Tabs.Settings,
      content: (
        <RichHistorySettings
          retentionPeriod={this.state.retentionPeriod}
          starredTabAsFirstTab={this.state.starredTabAsFirstTab}
          activeDatasourceOnly={this.state.activeDatasourceOnly}
          onChangeRetentionPeriod={this.onChangeRetentionPeriod}
          toggleStarredTabAsFirstTab={this.toggleStarredTabAsFirstTab}
          toggleactiveDatasourceOnly={this.toggleactiveDatasourceOnly}
        />
      ),
      icon: 'gicon gicon-preferences',
    };

    const tabs = [];
    tabs.push(QueriesTab);
    tabs.push(SettingsTab);

    /* If user selects to have starredTabAsFirstTab === true, move
     * StarredTab to first position, otherwise second
     */
    tabs.splice(starredTabAsFirstTab ? 0 : 1, 0, StarredTab);

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

export const RichHistory = withTheme(UnThemedRichHistory);
