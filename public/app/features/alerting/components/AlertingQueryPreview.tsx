import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import AutoSizer from 'react-virtualized-auto-sizer';
import { DataFrame, DataQuery, GrafanaTheme, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Icon, Tab, TabContent, TabsBar } from '@grafana/ui';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { PreviewQueryTab } from './PreviewQueryTab';
import { PreviewInstancesTab } from './PreviewInstancesTab';
import { EmptyState } from './EmptyState';
import { getData } from '../utils/queryPreview';
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
}

export class AlertingQueryPreview extends PureComponent<Props, State> {
  state = {
    activeTab: Tabs.Query,
  };

  onTabChange = (tabId: Tabs) => {
    this.setState({ activeTab: tabId });
  };

  renderQueryAndInstances(data?: PanelData) {
    const { activeTab } = this.state;
    const { instances, onTest } = this.props;

    if (!data) {
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
    const { queryRunner, queries } = this.props;

    const styles = getStyles(config.theme);
    const data = getData(queryRunner);

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
            this.renderQueryAndInstances(data)
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
