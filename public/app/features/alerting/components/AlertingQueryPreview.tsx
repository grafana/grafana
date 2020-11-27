import React, { useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { TabsBar, TabContent, Tab, stylesFactory, useStyles } from '@grafana/ui';

enum Tabs {
  Query = 'query',
  Instance = 'instance',
}

const tabs = [
  { id: Tabs.Query, text: 'Query', active: true },
  { id: Tabs.Instance, text: 'Alerting instance', active: false },
];

export const AlertingQueryPreview = ({}) => {
  const styles = useStyles(getStyles);
  const [activeTab, changeTab] = useState<string>('query');

  return (
    <div className={styles.wrapper}>
      <TabsBar>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={`${tab.id}-${index}`}
              label={tab.text}
              onChangeTab={() => changeTab(tab.id)}
              active={activeTab === tab.id}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab === Tabs.Query && <div>Query result</div>}
        {activeTab === Tabs.Instance && <div>Instance something something dark side</div>}
      </TabContent>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
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
});
