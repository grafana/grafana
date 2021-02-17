import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import _ from 'lodash';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';
import { DataFrame, DataQuery, GrafanaTheme, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Icon, Tab, TabContent, TabsBar } from '@grafana/ui';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
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

interface OwnProps {
  onTest: () => void;
}

interface ConnectedProps {
  queryRunner: PanelQueryRunner;
  instances: DataFrame[];
  queries: DataQuery[];
}

interface DispatchProps {
  onRunQueries: () => void;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  activeTab: Tabs;
  data: PanelData;
}

export class AlertingQueryPreview extends PureComponent<Props, State> {
  private subscription: Subscription;
  state = {
    activeTab: Tabs.Query,
    data: {} as PanelData,
  };

  componentDidMount() {
    this.subscription = this.props.queryRunner
      .getData({ withFieldConfig: true, withTransforms: true })
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
    const { instances, onTest, onRunQueries } = this.props;

    if (_.isEmpty(data)) {
      return (
        <EmptyState title="Run queries to view data.">
          <Button onClick={onRunQueries}>Run queries</Button>
        </EmptyState>
      );
    }
    return (
      <AutoSizer style={{ width: '100%', height: '100%' }}>
        {({ width, height }) => {
          switch (activeTab) {
            case Tabs.Instances:
              return (
                <PreviewInstancesTab
                  isTested={instances.length > 0}
                  instances={instances}
                  width={width}
                  height={height}
                  onTest={onTest}
                />
              );

            case Tabs.Query:
            default:
              return <PreviewQueryTab data={data} width={width} height={height} />;
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

  render() {
    const { queries } = this.props;
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
          {data && data.state === 'Error' ? (
            this.renderError(data)
          ) : queries && queries.length > 0 ? (
            this.renderQueryAndInstances()
          ) : (
            <EmptyState title="No queries added.">
              <div>Start adding queries to this alert and a visualisation for your queries will appear here.</div>
              <div>
                Learn more about how to create alert definitions <Icon name="external-link-alt" />
              </div>
            </EmptyState>
          )}
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

export type PreviewStyles = ReturnType<typeof getStyles>;

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

export default connect(mapStateToProps, mapDispatchToProps)(AlertingQueryPreview);
