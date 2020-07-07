import React, { useCallback } from 'react';
import { config } from 'app/core/config';
import { css } from 'emotion';
import { IconName, stylesFactory, Tab, TabContent, TabsBar } from '@grafana/ui';
import { PanelEditorTab, PanelEditorTabId } from './types';
import { DashboardModel } from '../../state';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import { PanelModel } from '../../state/PanelModel';
import { AlertTab } from 'app/features/alerting/AlertTab';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  tabs: PanelEditorTab[];
  onChangeTab: (tab: PanelEditorTab) => void;
}

export const PanelEditorTabs: React.FC<PanelEditorTabsProps> = ({ panel, dashboard, tabs, onChangeTab }) => {
  const styles = getPanelEditorTabsStyles();
  const activeTab = tabs.find(item => item.active);

  const getCounter = useCallback(
    (tab: PanelEditorTab) => {
      switch (tab.id) {
        case PanelEditorTabId.Query:
          return panel.targets.length;
        case PanelEditorTabId.Alert:
          return panel.alert ? 1 : 0;
        case PanelEditorTabId.Transform:
          const transformations = panel.getTransformations() ?? [];
          return transformations.length;
      }

      return null;
    },
    [panel]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <TabsBar className={styles.tabBar}>
        {tabs.map(tab => {
          return (
            <Tab
              key={tab.id}
              label={tab.text}
              active={tab.active}
              onChangeTab={() => onChangeTab(tab)}
              icon={tab.icon as IconName}
              counter={getCounter(tab)}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab.id === PanelEditorTabId.Query && <QueriesTab panel={panel} dashboard={dashboard} />}
        {activeTab.id === PanelEditorTabId.Alert && <AlertTab panel={panel} dashboard={dashboard} />}
        {activeTab.id === PanelEditorTabId.Transform && <TransformationsEditor panel={panel} />}
      </TabContent>
    </div>
  );
};

const getPanelEditorTabsStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    tabBar: css`
      padding-left: ${theme.spacing.md};
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      background: ${theme.colors.panelBg};
      border-right: 1px solid ${theme.colors.pageHeaderBorder};

      .toolbar {
        background: transparent;
      }
    `,
  };
});
