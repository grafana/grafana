import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useState, useMemo } from 'react';
import { useAsync, useCopyToClipboard } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelPlugin, GrafanaTheme2, AppEvents, SelectableValue, dateTimeFormat } from '@grafana/data';
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
import { contextSrv } from 'app/core/core';
import { InspectTab } from 'app/features/inspector/types';

import { getTimeSrv } from '../../services/TimeSrv';
import { PanelModel } from '../../state';
import { pendingNewDashboard } from '../../state/initDashboard';

import { Randomize } from './randomizer';
import { getGithubMarkdown, getTroubleshootingDashboard } from './utils';

interface Props {
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  onClose: () => void;
}

enum ShowMessge {
  PanelSnapshot = 'snap',
  GithubComment = 'github',
}

const options: Array<SelectableValue<ShowMessge>> = [
  {
    label: 'Github comment',
    description: 'Copy and paste this message into a github issue or comment',
    value: ShowMessge.GithubComment,
  },
  {
    label: 'Panel debug snapshot',
    description: 'Dashboard to help debug any visualization issues',
    value: ShowMessge.PanelSnapshot,
  },
];

export const DebugWizard = ({ panel, plugin, onClose }: Props) => {
  const styles = useStyles2(getStyles);
  const [currentTab, setCurrentTab] = useState(InspectTab.Debug);
  const [showMessage, setShowMessge] = useState(ShowMessge.GithubComment);
  const [snapshotText, setDashboardText] = useState('...');
  const [rand, setRand] = useState<Randomize>({});
  const [_, copyToClipboard] = useCopyToClipboard();
  const info = useAsync(async () => {
    const dash = await getTroubleshootingDashboard(panel, rand, getTimeSrv().timeRange());
    setDashboardText(JSON.stringify(dash, null, 2));
  }, [rand, panel, plugin, setDashboardText]);

  const messageText = useMemo(() => {
    console.log({ showMessage });
    if (showMessage === ShowMessge.GithubComment) {
      return getGithubMarkdown(panel, snapshotText);
    }
    return snapshotText;
  }, [snapshotText, showMessage, panel]);

  if (!plugin) {
    return null;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';

  const toggleRandomize = (k: keyof Randomize) => {
    setRand({ ...rand, [k]: !rand[k] });
  };

  const doImportDashboard = () => {
    pendingNewDashboard.dashboard = JSON.parse(snapshotText);
    locationService.push('/dashboard/new'); // will load the above body
    appEvents.emit(AppEvents.alertSuccess, ['Panel snapshot dashboard']);
  };

  const doDownloadDashboard = () => {
    const blob = new Blob([snapshotText], {
      type: 'text/plain',
    });
    const fileName = `debug-${panelTitle}-${dateTimeFormat(new Date())}.json.txt`;
    saveAs(blob, fileName);
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
              <Select
                options={options}
                value={options.find((v) => v.value === showMessage) ?? options[0]}
                onChange={(v) => setShowMessge(v.value ?? options[0].value!)}
              />
            </Field>
            <Button
              onClick={() => {
                copyToClipboard(messageText);
                appEvents.emit(AppEvents.alertSuccess, [`Message copied`]);
              }}
            >
              Copy
            </Button>
            {showMessage === ShowMessge.GithubComment && <Button onClick={doDownloadDashboard}>Download</Button>}
          </div>
          <AutoSizer disableWidth>
            {({ height }) => (
              <CodeEditor
                width="100%"
                height={height}
                language={showMessage === ShowMessge.GithubComment ? 'markdown' : 'json'}
                showLineNumbers={true}
                showMiniMap={true}
                value={messageText || ''}
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

          {/* TODO: can we iframe in the preview? */}
          {false && <iframe src={`/dashboard/new?orgId=${contextSrv.user.orgId}&kiosk`} width="100%" height={300} />}
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
