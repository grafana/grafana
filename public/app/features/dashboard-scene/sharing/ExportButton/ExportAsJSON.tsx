import { css } from 'emotion';
import saveAs from 'file-saver';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectRef } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Label, Stack, Switch, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { DashboardModel } from 'app/features/dashboard/state';

import { DashboardScene } from '../../scene/DashboardScene';
import { transformSceneToSaveModel } from '../../serialization/transformSceneToSaveModel';
import { getVariablesCompatibility } from '../../utils/getVariablesCompatibility';
import { DashboardInteractions } from '../../utils/interactions';

export interface Props {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export default function ExportAsJSON({ dashboardRef }: Props) {
  const [isSharingExternally, setSharingExternallyState] = useState(true);

  function onShareExternallyChange() {
    setSharingExternallyState(!isSharingExternally);
  }

  const _exporter = new DashboardExporter();
  async function getExportableDashboardJson() {
    const saveModel = transformSceneToSaveModel(dashboardRef.resolve());

    const exportable = isSharingExternally
      ? await _exporter.makeExportable(
          new DashboardModel(saveModel, undefined, {
            getVariablesFromState: () => {
              return getVariablesCompatibility(window.__grafanaSceneContext);
            },
          })
        )
      : saveModel;

    return exportable;
  }

  async function onSaveAsFile() {
    const dashboardJson = await getExportableDashboardJson();
    const dashboardJsonPretty = JSON.stringify(dashboardJson, null, 2);

    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });

    const time = new Date().getTime();
    let title = 'dashboard';
    if ('title' in dashboardJson && dashboardJson.title) {
      title = dashboardJson.title;
    }
    saveAs(blob, `${title}-${time}.json`);
    DashboardInteractions.exportDownloadJsonClicked({
      externally: isSharingExternally,
    });
  }

  function onClose() {
    dashboardRef.resolve().setState({ overlay: undefined });
  }

  const theme = useTheme2();
  const styles = getStyles(theme);

  const dashboardJson = useAsync(async () => {
    const json = await getExportableDashboardJson();
    return JSON.stringify(json, null, 2);
  }, [isSharingExternally]);

  const exportExternallyTranslation = t(
    'export.json.share-externally-label',
    `Export the dashboard to use in another instance`
  );

  return (
    <>
      <p className="share-modal-info-text">
        <Trans i18nKey="export.json.info-text">
          Copy or download a JSON file containing the JSON of your dashboard.
        </Trans>
      </p>

      <div className={styles.switchItem}>
        <Switch id="share-externally-toggle" value={isSharingExternally} onChange={onShareExternallyChange} />
        <Label className={styles.switchItemLabel}>{exportExternallyTranslation}</Label>
      </div>

      <AutoSizer disableHeight className={styles.codeEditorBox}>
        {({ width }) => {
          if (dashboardJson.value) {
            return (
              <CodeEditor
                value={dashboardJson.value ?? ''}
                language="json"
                showMiniMap={false}
                height="500px"
                width={width}
                readOnly={true}
              />
            );
          }

          if (dashboardJson.loading) {
            return <div>Loading...</div>;
          }

          return null;
        }}
      </AutoSizer>

      <Stack direction="row" wrap="wrap" alignItems="flex-start" gap={2} justifyContent="start">
        <Button variant="primary" icon="download-alt" onClick={onSaveAsFile}>
          <Trans i18nKey="export.json.save-button">Save to file</Trans>
        </Button>
        <ClipboardButton
          variant="secondary"
          icon="copy"
          disabled={dashboardJson.loading}
          getText={() => dashboardJson.value ?? ''}
        >
          <Trans i18nKey="export.json.copy-button">Copy to Clipboard</Trans>
        </ClipboardButton>
        <Button variant="secondary" onClick={onClose} fill="outline">
          <Trans i18nKey="export.json.cancel-button">Cancel</Trans>
        </Button>
      </Stack>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    switchItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    }),
    switchItemLabel: css({
      margin: `0 0 0 ${theme.spacing(1)}`,
      alignSelf: 'center',
    }),
    codeEditorBox: css({
      margin: '16px 0px',
    }),
  };
}
