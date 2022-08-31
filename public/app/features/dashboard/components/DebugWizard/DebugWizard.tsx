import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync, useCopyToClipboard } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelPlugin, GrafanaTheme2, AppEvents, PanelData, SelectableValue } from '@grafana/data';
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
  Alert,
  Select,
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

enum ShowContent {
  PanelSnapshot = 'snap',
  GithubComment = 'github',
}

const options: Array<SelectableValue<ShowContent>> = [
  {
    label: 'Github comment',
    description: 'Copy and paste this message into a github issue or comment',
    value: ShowContent.GithubComment,
  },
  {
    label: 'Panel debug snapshot',
    description: 'Dashboard to help debug any visualization issues',
    value: ShowContent.PanelSnapshot,
  },
];

export const DebugWizard = ({ panel, plugin, data, onClose }: Props) => {
  const styles = useStyles2(getStyles);
  const [currentTab, setCurrentTab] = useState(InspectTab.Debug);
  const [dashboardText, setDashboardText] = useState('...');
  const [rand, setRand] = useState<Randomize>({});
  const [_, copyToClipboard] = useCopyToClipboard();
  const info = useAsync(async () => {
    const dash = await getTroubleshootingDashboard(panel, rand, getTimeSrv().timeRange());
    setDashboardText(JSON.stringify(dash, null, 2));
  }, [rand, panel, plugin, setDashboardText]);

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
    { label: 'Wizard', value: InspectTab.Debug },
    { label: 'Reports', value: InspectTab.JSON },
  ];
  let activeTab = currentTab;
  if (!tabs.find((item) => item.value === currentTab)) {
    activeTab = InspectTab.JSON;
  }

  const renderError = () => {
    console.error('Error', info.error);
    return <Alert title="Error loading dashboard">{`${info.error}`}</Alert>;
  };

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';
  return (
    <Drawer
      title={`Debug: ${panelTitle}`}
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
                onChangeTab={() => setCurrentTab(t.value || InspectTab.Debug)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {info.loading && <Spinner />}
      {info.error && renderError()}

      {activeTab === InspectTab.JSON ? (
        <div className={styles.code}>
          <div className={styles.opts}>
            <Field label="Template" className={styles.field}>
              <Select options={options} value={options[0]} onChange={(v) => console.log(v)} />
            </Field>
            <Button onClick={() => copyToClipboard(dashboardText)}>Copy</Button>
            <Button onClick={() => alert('hello')}>Download</Button>
          </div>
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
                {/* <InlineSwitch
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
                /> */}
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
  field: css`
    width: 100%;
  `,
  opts: css`
    display: flex;
    border: 1px solid red;
    display: flex;
    width: 100%;
    flex-grow: 0;
    align-items: center;
    justify-content: flex-end;

    button {
      margin-left: 8px;
    }
  `,
});
