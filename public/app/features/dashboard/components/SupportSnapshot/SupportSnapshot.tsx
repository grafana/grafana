import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useState, useMemo, useEffect } from 'react';
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

import { ShowMessage, SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';
import { Randomize } from './randomizer';
import { getGithubMarkdown, getDebugDashboard } from './utils';

interface Props {
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  onClose: () => void;
}

export function SupportSnapshot({ panel, plugin, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const service = useMemo(() => new SupportSnapshotService(), []);

  const {
    currentTab,
    loading,
    error,
    iframeLoading,
    options,
    showMessage,
    snapshotSize,
    markdownText,
    snapshotText,
    randomize,
  } = service.useState();

  // const [_, copyToClipboard] = useCopyToClipboard();

  // const snapshot = useAsync(async () => {
  //   return getDebugDashboard(panel, rand, getTimeSrv().timeRange());
  // }, [rand, panel, plugin]);

  // const info = useAsync(async () => {
  //   const dashboard = snapshot.value;
  //   if (dashboard) {
  //     // When iframe is supported, pass the dashboard via local storage
  //     if (iframeLoading && currentTab === InspectTab.Support) {
  //       setDashboardToFetchFromLocalStorage({ meta: {}, dashboard });
  //     }
  //     setDashboardText(JSON.stringify(dashboard, null, 2));
  //   }
  // }, [snapshot, currentTab, iframeLoading]);

  // const snapshotSize = useMemo(() => {
  //   return formattedValueToString(getValueFormat('bytes')(snapshotText?.length ?? 0));
  // }, [snapshotText]);

  // const markdownText = useMemo(() => {
  //   return getGithubMarkdown(panel, snapshotText);
  // }, [snapshotText, panel]);

  // Listen for messages from loaded iframe
  // useEffect(() => {
  //   const handleEvent = (evt: MessageEvent<string>) => {
  //     if (evt.data === 'GrafanaAppInit') {
  //       setIframeLoading(true);
  //     }
  //   };
  //   window.addEventListener('message', handleEvent, false);
  //   return function cleanup() {
  //     window.removeEventListener('message', handleEvent);
  //   };
  // }, []);

  if (!plugin) {
    return null;
  }

  const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';

  // const toggleRandomize = (k: keyof Randomize) => {
  //   setRand({ ...rand, [k]: !rand[k] });
  // };

  // const doImportDashboard = () => {
  //   setDashboardToFetchFromLocalStorage({ meta: {}, dashboard: snapshot.value });
  //   global.open(config.appUrl + 'dashboard/new', '_blank');
  // };

  // const doDownloadDashboard = () => {
  //   const blob = new Blob([snapshotText], {
  //     type: 'text/plain',
  //   });
  //   const fileName = `debug-${panelTitle}-${dateTimeFormat(new Date())}.json.txt`;
  //   saveAs(blob, fileName);
  // };

  // const doCopyMarkdown = () => {
  //   const maxLen = Math.pow(1024, 2) * 1.5; // 1.5MB
  //   if (markdownText.length > maxLen) {
  //     appEvents.emit(AppEvents.alertError, [
  //       `Snapshot is too large`,
  //       'Consider downloading and attaching the file instead',
  //     ]);
  //     return;
  //   }

  //   copyToClipboard(markdownText);
  //   appEvents.emit(AppEvents.alertSuccess, [`Message copied`]);
  // };

  const tabs = [
    { label: 'Support', value: SnapshotTab.Support },
    { label: 'Data', value: SnapshotTab.Data },
  ];

  const renderError = () => {
    console.error('Error', error);
    return <Alert title="Error loading dashboard">{`${error}`}</Alert>;
  };

  return (
    <Drawer
      title={`Panel: ${panelTitle}`}
      width="90%"
      onClose={onClose}
      expandable
      scrollableContent
      subtitle={
        <div>
          <p>
            <FeatureBadge featureState={FeatureState.beta} />
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
                active={t.value === currentTab}
                onChangeTab={() => service.onCurrentTabChange(t.value!)}
              />
            );
          })}
        </TabsBar>
      }
    >
      {loading && <Spinner />}
      {error && renderError()}

      {currentTab === SnapshotTab.Data && (
        <div className={styles.code}>
          <div className={styles.opts}>
            <Field label="Template" className={styles.field}>
              <Select options={options} value={showMessage} onChange={service.onShowMessageChange} />
            </Field>

            {showMessage === ShowMessage.GithubComment ? (
              <Button icon="github" onClick={service.onCopyMarkdown}>
                Copy
              </Button>
            ) : (
              <Button icon="download-alt" onClick={service.onDownloadDashboard}>
                Download ({snapshotSize})
              </Button>
            )}
          </div>
          <AutoSizer disableWidth>
            {({ height }) => (
              <CodeEditor
                width="100%"
                height={height}
                language={showMessage === ShowMessage.GithubComment ? 'markdown' : 'json'}
                showLineNumbers={true}
                showMiniMap={true}
                value={showMessage === ShowMessage.GithubComment ? markdownText : snapshotText}
                readOnly={false}
                onBlur={service.onSetSnapshotText}
              />
            )}
          </AutoSizer>
        </div>
      )}
      {currentTab === SnapshotTab.Support && (
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
                  value={Boolean(randomize.labels)}
                  onChange={() => service.onToggleRandomize('labels')}
                />
                <InlineSwitch
                  label="Field names"
                  showLabel={true}
                  value={Boolean(randomize.names)}
                  onChange={() => service.onToggleRandomize('names')}
                />
                <InlineSwitch
                  label="String values"
                  showLabel={true}
                  value={Boolean(randomize.values)}
                  onChange={() => service.onToggleRandomize('values')}
                />
              </HorizontalGroup>
            </Field>
          )}

          <Field
            label="Support snapshot"
            description="This snapshot contains the query response data and raw panel settings.  Including this snapshot in support requests can help identify issues faster."
          >
            <>
              <HorizontalGroup>
                <Button icon="download-alt" onClick={service.onDownloadDashboard}>
                  Dashboard ({snapshotSize})
                </Button>
                <Button icon="github" onClick={service.onCopyMarkdown} title="Paste this into a github issue">
                  Copy for github
                </Button>
                <Button onClick={service.onPreviewDashboard} variant="secondary">
                  Preview
                </Button>
              </HorizontalGroup>
            </>
          </Field>

          <AutoSizer disableWidth>
            {({ height }) => (
              <>
                <iframe
                  src={`${config.appUrl}dashboard/new?orgId=${contextSrv.user.orgId}&kiosk`}
                  width="100%"
                  height={height - 100}
                  frameBorder="0"
                  style={{
                    display: iframeLoading ? 'block' : 'none',
                  }}
                />
                {!iframeLoading && <div>&nbsp;</div>}
              </>
            )}
          </AutoSizer>
        </>
      )}
    </Drawer>
  );
}

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
