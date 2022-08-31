import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelPlugin, GrafanaTheme2, AppEvents, PanelData } from '@grafana/data';
import { getTemplateSrv, locationService } from '@grafana/runtime';
import {
  Drawer,
  Tab,
  TabsBar,
  CodeEditor,
  useStyles2,
  Field,
  HorizontalGroup,
  InlineSwitch,
  Button,
  Spinner,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { InspectTab } from 'app/features/inspector/types';

import { getTimeSrv } from '../../services/TimeSrv';
import { PanelModel } from '../../state';
import { pendingNewDashboard } from '../../state/initDashboard';

import { Randomize } from './randomizer';
import { getTroubleshootingDashboard } from './utils';

interface Props {
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  data?: PanelData;
  onClose: () => void;
}

export const Troubleshooter = ({ panel, plugin, data, onClose }: Props) => {
  console.log('Troubleshooter', data);
  const styles = useStyles2(getStyles);
  const [currentTab, setCurrentTab] = useState(InspectTab.Trouble);
  const [dashboardText, setDashboardText] = useState('...');
  const [rand, setRand] = useState<Randomize>({});
  const info = useAsync(async () => {
    console.log('LOADING', plugin);
    if (!data) {
      return false;
    }
    const dash = await getTroubleshootingDashboard(panel, rand, getTimeSrv().timeRange());
    setDashboardText(JSON.stringify(dash, null, 2));
    console.log('LOADED', dash);
    return true;
  }, [rand, panel, data, plugin, setDashboardText]);

  if (!plugin) {
    return null;
  }

  const toggleRandomize = (k: keyof Randomize) => {
    setRand({ ...rand, [k]: !rand[k] });
  };

  const doImportDashboard = () => {
    pendingNewDashboard.dashboard = JSON.parse(dashboardText);
    locationService.push('/dashboard/new'); // will load the above body
    appEvents.emit(AppEvents.alertSuccess, ['Panel snapshot dashboard']);
  };

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
      {info.loading && <Spinner />}
      {info.value === false && <div>No data</div>}
      <pre>{JSON.stringify(info)}</pre>

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
        <div>
          <h3>Snapshot</h3>
          <div>
            <Field
              label="Randomize data"
              description="Modify the original data to hide sensitve information.  Note the lengths will stay the same, and duplicate values will be equal."
            >
              <HorizontalGroup>
                <InlineSwitch
                  label="Labels"
                  showLabel={true}
                  value={Boolean(rand.labels)}
                  onChange={(v) => toggleRandomize('labels')}
                />
                <InlineSwitch
                  label="Field names"
                  showLabel={true}
                  value={Boolean(rand.names)}
                  onChange={(v) => toggleRandomize('names')}
                />
                <InlineSwitch
                  label="String values"
                  showLabel={true}
                  value={Boolean(rand.values)}
                  onChange={(v) => toggleRandomize('values')}
                />
              </HorizontalGroup>
            </Field>
          </div>

          <Button onClick={doImportDashboard}>Preview</Button>
        </div>
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
