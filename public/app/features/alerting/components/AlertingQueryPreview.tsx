import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';
import { DataFrame, DataQuery, GrafanaTheme, PanelData } from '@grafana/data';
import { Icon, Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { PreviewQueryTab } from './PreviewQueryTab';
import { PreviewInstancesTab } from './PreviewInstancesTab';
import { EmptyState } from './EmptyState';

enum Tabs {
  Query = 'query',
  Instances = 'instances',
}

const tabs = [
  { id: Tabs.Query, text: 'Query result' },
  { id: Tabs.Instances, text: 'Alerting instances' },
];

interface Props {
  getInstances: () => DataFrame[];
  queries: DataQuery[];
  onTest: () => void;
}

export const AlertingQueryPreview: FC<Props> = ({ getInstances, onTest, queries }) => {
  const [activeTab, setActiveTab] = useState<string>(Tabs.Query);
  const styles = useStyles(getStyles);

  let data = {} as PanelData;

  const instances = getInstances();

  return (
    <div className={styles.wrapper}>
      <TabsBar>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={`${tab.id}-${index}`}
              label={tab.text}
              onChangeTab={() => setActiveTab(tab.id)}
              active={activeTab === tab.id}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {data &&
          (data.state === 'Error' ? (
            <EmptyState title="There was an error :(">
              <div>{data.error?.data?.error}</div>
            </EmptyState>
          ) : (
            <QueriesAndInstances
              instances={instances}
              onTest={onTest}
              data={data}
              activeTab={activeTab}
              queries={queries}
            />
          ))}
      </TabContent>
    </div>
  );
};

interface PreviewProps {
  queries: DataQuery[];
  instances: DataFrame[];
  onTest: () => void;
  data: PanelData;
  activeTab: string;
}

const QueriesAndInstances: FC<PreviewProps> = ({ queries, instances, onTest, data, activeTab }) => {
  if (queries.length === 0) {
    return (
      <EmptyState title="No queries added.">
        <div>Start adding queries to this alert and a visualisation for your queries will appear here.</div>
        <div>
          Learn more about how to create alert definitions <Icon name="external-link-alt" />
        </div>
      </EmptyState>
    );
  }

  return (
    <AutoSizer style={{ width: '100%', height: '100%' }}>
      {({ width, height }) => {
        switch (activeTab) {
          case Tabs.Instances:
            return <PreviewInstancesTab instances={instances} width={width} height={height} onTest={onTest} />;

          case Tabs.Query:
          default:
            return <PreviewQueryTab data={data} width={width} height={height} />;
        }
      }}
    </AutoSizer>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
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
