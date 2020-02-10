import React, { useState } from 'react';
import { css } from 'emotion';
import AutoSizer from 'react-virtualized-auto-sizer';
import useMeasure from 'react-use/lib/useMeasure';
import { TabsBar, Tab, stylesFactory, TabContent } from '@grafana/ui';
import { EditorTab, allTabs } from './types';
import { DashboardModel } from '../../state';
import { QueriesTab } from '../../panel_editor/QueriesTab';
import { PanelModel } from '../../state/PanelModel';
import { AlertTab } from 'app/features/alerting/AlertTab';

interface PanelEditorTabsProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

const getPanelEditorTabsStyles = stylesFactory(() => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    content: css`
      flex-grow: 1;
    `,
  };
});
export const PanelEditorTabs: React.FC<PanelEditorTabsProps> = ({ panel, dashboard }) => {
  const [activeTab, setActiveTab] = useState(EditorTab.Query);
  const [tabsBarRef, tabsBarMeasurements] = useMeasure();
  const styles = getPanelEditorTabsStyles();

  return (
    <div className={styles.wrapper}>
      <div>
        <TabsBar ref={tabsBarRef}>
          {allTabs.map(t => {
            if (t.show(panel)) {
              return (
                <Tab
                  label={t.label}
                  active={activeTab === t.tab}
                  onChangeTab={() => {
                    setActiveTab(t.tab);
                  }}
                />
              );
            }
            return null;
          })}
        </TabsBar>
      </div>
      <div style={{ flexGrow: 1 }}>
        <TabContent style={{ height: `calc(100% - ${tabsBarMeasurements.height}px)` }}>
          <AutoSizer>
            {({ width, height }) => {
              return (
                <div style={{ width, height }}>
                  {activeTab === EditorTab.Query && <QueriesTab panel={panel} dashboard={dashboard} />}
                  {activeTab === EditorTab.Alerts && <AlertTab panel={panel} dashboard={dashboard} />}
                  {activeTab === EditorTab.Transform && <div>TODO: Show Transform</div>}
                </div>
              );
            }}
          </AutoSizer>
        </TabContent>
      </div>
    </div>
  );
};
