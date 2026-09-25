import { useBooleanFlagValue } from '@openfeature/react-sdk';
import yaml from 'js-yaml';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Modal } from '@grafana/ui';
import { ExportFormat } from 'app/features/dashboard/api/types';

import { ResourceExport } from './ExportButton/ResourceExport';
import { type ShareExportTab } from './ShareExportTab';

export function ShareExportTabRenderer({ model }: SceneComponentProps<ShareExportTab>) {
  const { isSharingExternally, isViewingJSON, modalRef, exportFormat, isViewingYAML } = model.useState();
  const isDynamicDashboardsEnabled = useBooleanFlagValue('dashboardNewLayouts', false);

  const dashboardJson = useAsync(async () => {
    return model.getExportableDashboardJson();
  }, [model, isViewingJSON, isSharingExternally, exportFormat]);

  const stringifiedDashboardJson = JSON.stringify(dashboardJson.value?.json, null, 2);
  const stringifiedDashboardYAML = yaml.dump(dashboardJson.value?.json, {
    skipInvalid: true,
  });
  const stringifiedDashboard = isViewingYAML ? stringifiedDashboardYAML : stringifiedDashboardJson;

  return (
    <>
      {!isViewingJSON && (
        <>
          <p>
            <Trans i18nKey="share-modal.export.info-text">Export this dashboard.</Trans>
          </p>
          <ResourceExport
            dashboardJson={dashboardJson}
            isSharingExternally={isSharingExternally ?? false}
            exportFormat={exportFormat ?? (isDynamicDashboardsEnabled ? ExportFormat.V2Resource : ExportFormat.Classic)}
            isViewingYAML={isViewingYAML ?? false}
            onExportFormatChange={model.onExportFormatChange}
            onShareExternallyChange={model.onShareExternallyChange}
            onViewYAML={model.onViewYAML}
          />

          <Modal.ButtonRow>
            <Button
              variant="secondary"
              onClick={() => {
                modalRef?.resolve().onDismiss();
              }}
              fill="outline"
            >
              <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
            </Button>
            {isViewingYAML ? (
              <Button variant="secondary" icon="brackets-curly" onClick={model.onViewJSON}>
                <Trans i18nKey="share-modal.export.view-button-yaml">View YAML</Trans>
              </Button>
            ) : (
              <Button variant="secondary" icon="brackets-curly" onClick={model.onViewJSON}>
                <Trans i18nKey="share-modal.export.view-button">View JSON</Trans>
              </Button>
            )}
            <Button variant="primary" icon="save" onClick={() => model.onSaveAsFile()}>
              <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
      {isViewingJSON && (
        <>
          <AutoSizer disableHeight>
            {({ width }) => {
              if (dashboardJson.value) {
                return (
                  <CodeEditor
                    value={stringifiedDashboard}
                    showLineNumbers={true}
                    language={isViewingYAML ? 'yaml' : 'json'}
                    showMiniMap={false}
                    height="500px"
                    width={width}
                  />
                );
              }

              if (dashboardJson.loading) {
                return (
                  <div>
                    {' '}
                    <Trans i18nKey="share-modal.export.loading">Loading...</Trans>
                  </div>
                );
              }

              return null;
            }}
          </AutoSizer>

          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={model.onViewJSON} icon="arrow-left">
              <Trans i18nKey="share-modal.export.back-button">Back to export config</Trans>
            </Button>
            <ClipboardButton
              variant="secondary"
              icon="copy"
              disabled={dashboardJson.loading}
              getText={() => stringifiedDashboard ?? ''}
              onClipboardCopy={model.onClipboardCopy}
            >
              <Trans i18nKey="share-modal.view-json.copy-button">Copy to Clipboard</Trans>
            </ClipboardButton>
            <Button variant="primary" icon="save" disabled={dashboardJson.loading} onClick={() => model.onSaveAsFile()}>
              <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </>
  );
}
