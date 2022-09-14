import { css } from '@emotion/css';
import React, { useMemo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelPlugin, GrafanaTheme2, FeatureState } from '@grafana/data';
import { config } from '@grafana/runtime';
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
import { contextSrv } from 'app/core/services/context_srv';
import { PanelModel } from 'app/features/dashboard/state';

import { ShowMessage, SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';

interface Props {
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  onClose: () => void;
}

export function SupportSnapshot({ panel, plugin, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const service = useMemo(() => new SupportSnapshotService(panel), [panel]);

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
    panelTitle,
  } = service.useState();

  useEffect(() => {
    service.buildDebugDashboard();
  }, [service, plugin, randomize]);

  // Listen for messages from loaded iframe
  useEffect(() => {
    return service.subscribeToIframeLoadingMessage();
  }, [service]);

  if (!plugin) {
    return null;
  }

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
