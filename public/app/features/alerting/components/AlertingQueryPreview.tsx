import React, { FC, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { TabsBar, TabContent, Tab, useStyles, Table } from '@grafana/ui';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';

enum Tabs {
  Query = 'query',
  Instance = 'instance',
}

const tabs = [
  { id: Tabs.Query, text: 'Query', active: true },
  { id: Tabs.Instance, text: 'Alerting instance', active: false },
];

interface Props {
  queryRunner: PanelQueryRunner;
}

export const AlertingQueryPreview: FC<Props> = ({ queryRunner }) => {
  const [activeTab, setActiveTab] = useState<string>('query');
  const styles = useStyles(getStyles);

  const observable = useMemo(() => queryRunner.getData({ withFieldConfig: true, withTransforms: true }), []);
  const data = useObservable(observable);
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
        {activeTab === Tabs.Query && data && (
          <div>
            <Table data={data.series[0]} width={1200} height={300} />
          </div>
        )}
        {activeTab === Tabs.Instance && <div>Instance something something dark side</div>}
      </TabContent>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  const tabBarHeight = 42;

  return {
    wrapper: css`
      label: alertDefinitionPreviewTabs;
      width: 100%;
      height: 100%;
      padding: ${theme.spacing.md} 0 0 ${theme.spacing.md};
    `,
    tabContent: css`
      background: ${theme.colors.panelBg};
      height: calc(100% - ${tabBarHeight}px);
    `,
  };
};
