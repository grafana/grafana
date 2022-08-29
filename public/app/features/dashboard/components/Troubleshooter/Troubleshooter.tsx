import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelData, PanelPlugin, GrafanaTheme2 } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Drawer, Tab, TabsBar, CodeEditor, useStyles2 } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

import { getTimeSrv } from '../../services/TimeSrv';
import { DashboardModel, PanelModel } from '../../state';

import { Randomize } from './randomizer';
import { getTroubleshootingDashboard } from './utils';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  data?: PanelData;
  onClose: () => void;
}

export const Troubleshooter = ({ panel, plugin, dashboard, data, onClose }: Props) => {
  const styles = useStyles2(getStyles);
  const [currentTab, setCurrentTab] = useState(InspectTab.Trouble);
  const [dashboardText, setDashboardText] = useState('???');
  const [rand] = useState<Randomize>({});
  useAsync(async () => {
    const dash = await getTroubleshootingDashboard(panel, rand, getTimeSrv().timeRange());
    setDashboardText(JSON.stringify(dash, null, 2));
    console.log('LOADING', dash);
  }, [rand, panel, setDashboardText]);

  if (!plugin) {
    return null;
  }

  const tabs = [
    { label: 'Troubleshooter', value: InspectTab.Trouble },
    { label: 'GitHub', value: InspectTab.JSON },
  ];
  let activeTab = currentTab;
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';
  return (
    <Drawer
      title={panelTitle}
      width="50%"
      onClose={onClose}
      expandable
      scrollableContent
      tabs={
        <TabsBar>
          {tabs.map((t, index) => {
            return (
              <Tab
                key={`${t.value}-${index}`}
                label={t.label}
                active={t.value === activeTab}
                onChangeTab={() => setCurrentTab(t.value || InspectTab.Trouble)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {activeTab === InspectTab.JSON ? (
        <div className={styles.code}>
          <div>Paste this code in a github issue</div>
          <AutoSizer disableWidth>
            {({ height }) => (
              <CodeEditor
                width="100%"
                height={height}
                language="json"
                showLineNumbers={true}
                showMiniMap={true}
                value={dashboardText || ''}
                readOnly={false}
                onBlur={setDashboardText}
              />
            )}
          </AutoSizer>
        </div>
      ) : (
        <div>The troubleshooting form!</div>
      )}
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  code: css`
    flex-grow: 1;
    height: 100%;
    overflow: scroll;
  `,
});
