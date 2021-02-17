import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { css } from 'emotion';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';
import { GrafanaTheme, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, Tab, TabContent, TabsBar } from '@grafana/ui';
import { PreviewQueryTab } from './PreviewQueryTab';
import { PreviewInstancesTab } from './PreviewInstancesTab';
import { EmptyState } from './EmptyState';
import { StoreState } from '../../../types';
import { onRunQueries } from '../state/actions';

enum Tabs {
  Query = 'query',
  Instances = 'instances',
}

const tabs = [
  { id: Tabs.Query, text: 'Query result' },
  { id: Tabs.Instances, text: 'Alerting instances' },
];

interface State {
  activeTab: Tabs;
  data: PanelData;
}

const mapStateToProps = (state: StoreState) => {
  const queries = state.alertDefinition.getQueryOptions().queries;
  const instances = state.alertDefinition.getInstances();

  return {
    queryRunner: state.alertDefinition.queryRunner,
    instances,
    queries,
  };
};

const mapDispatchToProps = {
  onRunQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {
  onTest: () => void;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

class AlertingQueryPreviewUnconnected extends PureComponent<Props, State> {
  private subscription: Subscription;
  state = {
    activeTab: Tabs.Query,
    data: {} as PanelData,
  };

  componentDidMount() {
    this.subscription = this.props
      .queryRunner!.getData({ withFieldConfig: true, withTransforms: true })
      .subscribe((data) => {
        this.setState({ data });
      });
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onTabChange = (tabId: Tabs) => {
    this.setState({ activeTab: tabId });
  };

  renderQueryAndInstances() {
    const { activeTab, data } = this.state;
    const { instances, onTest, onRunQueries, queries } = this.props;

    if (queries && queries.length > 0) {
      this.renderNoQueries();
    }

    return (
      <AutoSizer style={{ width: '100%', height: '100%' }}>
        {({ width, height }) => {
          switch (activeTab) {
            case Tabs.Instances:
              return <PreviewInstancesTab instances={instances} width={width} height={height} onTest={onTest} />;

            case Tabs.Query:
            default:
              return <PreviewQueryTab data={data} width={width} height={height} onRunQueries={onRunQueries} />;
          }
        }}
      </AutoSizer>
    );
  }

  renderError(data: PanelData) {
    return (
      <EmptyState title="There was an error :(">
        <div>{data.error?.data?.error}</div>
      </EmptyState>
    );
  }

  renderNoQueries() {
    return (
      <EmptyState title="No queries added.">
        <div>Start adding queries to this alert and a visualisation for your queries will appear here.</div>
        <div>
          Learn more about how to create alert definitions <Icon name="external-link-alt" />
        </div>
      </EmptyState>
    );
  }

  render() {
    const { data } = this.state;
    const styles = getStyles(config.theme);

    return (
      <div className={styles.wrapper}>
        <TabsBar>
          {tabs.map((tab, index) => {
            return (
              <Tab
                key={`${tab.id}-${index}`}
                label={tab.text}
                onChangeTab={() => this.onTabChange(tab.id)}
                active={this.state.activeTab === tab.id}
              />
            );
          })}
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {data && data.state === 'Error' ? this.renderError(data) : this.renderQueryAndInstances()}
        </TabContent>
      </div>
    );
  }
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      label: alertDefinitionPreviewTabs;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: ${theme.spacing.md} 0 0 ${theme.spacing.md};
    `,
    tabContent: css`
      background: ${theme.colors.panelBg};
      height: 100%;
    `,
  };
};

export const AlertingQueryPreview = connector(AlertingQueryPreviewUnconnected);
