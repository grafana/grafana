import React from 'react';
import { config } from 'app/core/config';
import { css } from 'emotion';
import { TabsBar, Tab, stylesFactory, TabContent, IconName } from '@grafana/ui';
import { DataTransformerConfig, LoadingState, PanelData } from '@grafana/data';
import { PanelEditorTab, PanelEditorTabId } from './types';
import { DashboardModel } from '../../state';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import { PanelModel } from '../../state/PanelModel';
import { AlertTab } from 'app/features/alerting/AlertTab';
import { VisualizationTab } from './VisualizationTab';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  tabs: PanelEditorTab[];
  onChangeTab: (tab: PanelEditorTab) => void;
  data: PanelData;
}

export const PanelEditorTabs: React.FC<PanelEditorTabsProps> = ({ panel, dashboard, tabs, data, onChangeTab }) => {
  const styles = getPanelEditorTabsStyles();
  const activeTab = tabs.find(item => item.active);

  if (tabs.length === 0) {
    return null;
  }

  const onTransformersChange = (transformers: DataTransformerConfig[]) => {
    panel.setTransformations(transformers);
  };

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
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab.id === PanelEditorTabId.Query && <QueriesTab panel={panel} dashboard={dashboard} />}
        {activeTab.id === PanelEditorTabId.Alert && <AlertTab panel={panel} dashboard={dashboard} />}
        {activeTab.id === PanelEditorTabId.Visualize && <VisualizationTab panel={panel} />}
        {activeTab.id === PanelEditorTabId.Transform && data.state !== LoadingState.NotStarted && (
          <TransformationsEditor
            transformations={panel.transformations || []}
            onChange={onTransformersChange}
            dataFrames={data.series}
          />
        )}
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
      background: ${theme.palette.panelBg};
      border-right: 1px solid ${theme.palette.pageHeaderBorder};

      .toolbar {
        background: transparent;
      }
    `,
  };
});
