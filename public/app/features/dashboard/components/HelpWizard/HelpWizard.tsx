import { css } from '@emotion/css';
import React, { useMemo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelPlugin, GrafanaTheme2, FeatureState } from '@grafana/data';
import { Stack } from '@grafana/experimental';
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
  ClipboardButton,
  Icon,
} from '@grafana/ui';
import { PanelModel } from 'app/features/dashboard/state';

import { ShowMessage, SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';

interface Props {
  panel: PanelModel;
  plugin?: PanelPlugin | null;
  onClose: () => void;
}

export function HelpWizard({ panel, plugin, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const service = useMemo(() => new SupportSnapshotService(panel), [panel]);

  const {
    currentTab,
    loading,
    error,
    scene,
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

  if (!plugin) {
    return null;
  }

  const tabs = [
    { label: 'Snapshot', value: SnapshotTab.Support },
    { label: 'Data', value: SnapshotTab.Data },
  ];

  return (
    <Drawer
      title={`Get help with this panel`}
      width="90%"
      onClose={onClose}
      expandable
      scrollableContent
      subtitle={
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1}>
            <FeatureBadge featureState={FeatureState.beta} />
            <a
              href="https://grafana.com/docs/grafana/latest/troubleshooting/"
              target="blank"
              className="external-link"
              rel="noopener noreferrer"
            >
              Troubleshooting docs <Icon name="external-link-alt" />
            </a>
          </Stack>
          <span className="muted">
            To request troubleshooting help, send a snapshot of this panel to Grafana Labs Technical Support. The
            snapshot contains query response data and panel settings.
          </span>
        </Stack>
      }
      tabs={
        <TabsBar>
          {tabs.map((t, index) => (
            <Tab
              key={`${t.value}-${index}`}
              label={t.label}
              active={t.value === currentTab}
              onChangeTab={() => service.onCurrentTabChange(t.value!)}
            />
          ))}
        </TabsBar>
      }
    >
      <div className={styles.container}>
        {loading && <Spinner />}
        {error && <Alert title={error.title}>{error.message}</Alert>}

        {currentTab === SnapshotTab.Data && (
          <div className={styles.code}>
            <div className={styles.opts}>
              <Field label="Template" className={styles.field}>
                <Select options={options} value={showMessage} onChange={service.onShowMessageChange} />
              </Field>

              {showMessage === ShowMessage.GithubComment ? (
                <ClipboardButton icon="copy" getText={service.onGetMarkdownForClipboard}>
                  Copy to clipboard
                </ClipboardButton>
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
            <Field
              label="Randomize data"
              description="Modify the original data to hide sensitve information.  Note the lengths will stay the same, and duplicate values will be equal."
            >
              <HorizontalGroup>
                <InlineSwitch
                  label="Labels"
                  id="randomize-labels"
                  showLabel={true}
                  value={Boolean(randomize.labels)}
                  onChange={() => service.onToggleRandomize('labels')}
                />
                <InlineSwitch
                  label="Field names"
                  id="randomize-field-names"
                  showLabel={true}
                  value={Boolean(randomize.names)}
                  onChange={() => service.onToggleRandomize('names')}
                />
                <InlineSwitch
                  label="String values"
                  id="randomize-string-values"
                  showLabel={true}
                  value={Boolean(randomize.values)}
                  onChange={() => service.onToggleRandomize('values')}
                />
              </HorizontalGroup>
            </Field>

            <Field label="Support snapshot" description={`Panel: ${panelTitle}`}>
              <Stack>
                <Button icon="download-alt" onClick={service.onDownloadDashboard}>
                  Dashboard ({snapshotSize})
                </Button>
                <ClipboardButton
                  icon="github"
                  getText={service.onGetMarkdownForClipboard}
                  title="Copy a complete GitHub comment to the clipboard"
                >
                  Copy to clipboard
                </ClipboardButton>
                <Button
                  onClick={service.onPreviewDashboard}
                  variant="secondary"
                  title="Open support snapshot dashboard in a new tab"
                >
                  Preview
                </Button>
              </Stack>
            </Field>
            <div className={styles.sceneWrapper}>{scene && <scene.Component model={scene} />}</div>
          </>
        )}
      </div>
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
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }),
  sceneWrapper: css({
    display: 'flex',
    flexGrow: 1,
    padding: theme.spacing(1),
    background: theme.colors.background.canvas,
  }),
});
