import { css } from '@emotion/css';
import React, { useMemo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, FeatureState } from '@grafana/data';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
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
  Stack,
} from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { ShowMessage, SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';

interface Props {
  panel: VizPanel;
  onClose: () => void;
}

export function HelpWizard({ panel, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const service = useMemo(() => new SupportSnapshotService(panel), [panel]);
  const plugin = panel.getPlugin();

  const {
    currentTab,
    loading,
    error,
    options,
    showMessage,
    snapshotSize,
    markdownText,
    snapshotText,
    randomize,
    panelTitle,
    scene,
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

  const hasSupportBundleAccess =
    config.supportBundlesEnabled && contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesCreate);

  return (
    <Drawer
      title={`Get help with this panel`}
      size="lg"
      onClose={onClose}
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
          {hasSupportBundleAccess && (
            <span className="muted">
              You can also retrieve a support bundle containing information concerning your Grafana instance and
              configured datasources in the <a href="/support-bundles">support bundles section</a>.
            </span>
          )}
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
            </Stack>
          </Field>

          <AutoSizer disableWidth>
            {({ height }) => (
              <div style={{ height, overflow: 'auto' }}>{scene && <scene.Component model={scene} />}</div>
            )}
          </AutoSizer>
        </>
      )}
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    code: css({
      flexGrow: 1,
      height: '100%',
      overflow: 'scroll',
    }),
    field: css({
      width: '100%',
    }),
    opts: css({
      display: 'flex',
      width: '100%',
      flexGrow: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',

      '& button': {
        marginLeft: theme.spacing(1),
      },
    }),
  };
};
