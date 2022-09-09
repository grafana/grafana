import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useState, useMemo } from 'react';
import { useAsync, useCopyToClipboard } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  PanelPlugin,
  GrafanaTheme2,
  AppEvents,
  SelectableValue,
  dateTimeFormat,
  getValueFormat,
  FeatureState,
  formattedValueToString,
} from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
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
  FeatureBadge,
  Select,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { setDashboardToFetchFromLocalStorage } from 'app/features/dashboard/state/initDashboard';
import { InspectTab } from 'app/features/inspector/types';

import { Randomize } from './randomizer';
import { getGithubMarkdown, getDebugDashboard } from './utils';

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
    const dashboard = await getDebugDashboard(panel, rand, getTimeSrv().timeRange());
    setDashboardToFetchFromLocalStorage({ meta: {}, dashboard });
    setDashboardText(JSON.stringify(dashboard, null, 2));
  }, [rand, panel, plugin, setDashboardText, currentTab]);

  const snapshotSize = useMemo(() => {
    return formattedValueToString(getValueFormat('bytes')(snapshotText?.length ?? 0));
  }, [snapshotText]);

  const markdownText = useMemo(() => {
    return getGithubMarkdown(panel, snapshotText);
  }, [snapshotText, panel]);

  if (!plugin) {
    return null;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';

  const toggleRandomize = (k: keyof Randomize) => {
    setRand({ ...rand, [k]: !rand[k] });
  };

  const doImportDashboard = () => {
    setDashboardToFetchFromLocalStorage({ meta: {}, dashboard: JSON.parse(snapshotText) });
    global.open(config.appUrl + 'dashboard/new', '_blank');
  };

  const doDownloadDashboard = () => {
    const blob = new Blob([snapshotText], {
      type: 'text/plain',
    });
    const fileName = `debug-${panelTitle}-${dateTimeFormat(new Date())}.json.txt`;
    saveAs(blob, fileName);
  };

  const doCopyMarkdown = () => {
    copyToClipboard(markdownText);
    appEvents.emit(AppEvents.alertSuccess, [`Message copied`]);
  };

  const tabs = [
    { label: 'Snapshot', value: InspectTab.Debug },
    { label: 'Code', value: InspectTab.JSON },
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
      width="90%"
      onClose={onClose}
      expandable
      scrollableContent
      subtitle={
        <div>
          <p>
            <FeatureBadge featureState={FeatureState.alpha} />
          </p>
        </div>
      }
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

            {showMessage === ShowMessge.GithubComment ? (
              <Button icon="github" onClick={doCopyMarkdown}>
                Copy
              </Button>
            ) : (
              <Button icon="download-alt" onClick={doDownloadDashboard}>
                Download ({snapshotSize})
              </Button>
            )}
          </div>
          <AutoSizer disableWidth>
            {({ height }) => (
              <CodeEditor
                width="100%"
                height={height}
                language={showMessage === ShowMessge.GithubComment ? 'markdown' : 'json'}
                showLineNumbers={true}
                showMiniMap={true}
                value={showMessage === ShowMessge.GithubComment ? markdownText : snapshotText}
                readOnly={false}
                onBlur={setDashboardText}
              />
            )}
          </AutoSizer>
        </div>
      ) : (
        <>
          {false && (
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
          )}

          <Field
            label="Debug snapshot"
            description="A panel debug snapshot creates a dashboard that can reproduce visualization issues while disconnected from the original data sources."
          >
            <>
              <HorizontalGroup>
                <Button icon="download-alt" onClick={doDownloadDashboard}>
                  Download ({snapshotSize})
                </Button>
                <Button icon="github" onClick={doCopyMarkdown}>
                  Copy for github
                </Button>
                <Button onClick={doImportDashboard} variant="secondary">
                  Preview
                </Button>
              </HorizontalGroup>
            </>
          </Field>

          <AutoSizer disableWidth>
            {({ height }) => (
              <iframe
                src={`/dashboard/new?orgId=${contextSrv.user.orgId}&kiosk`}
                width="100%"
                height={height - 100}
                frameBorder="0"
              />
            )}
          </AutoSizer>
        </>
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
