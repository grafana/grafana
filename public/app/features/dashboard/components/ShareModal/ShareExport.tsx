import { saveAs } from 'file-saver';
import { memo, useState, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Drawer, Field, Modal, Switch, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal/DashboardExporter';
import { makeExportableV1 } from 'app/features/dashboard-scene/scene/export/exporters';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { BulkExportProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkExportProvisionedResource';
import { ShowModalReactEvent } from 'app/types/events';

import { ViewJsonModal } from './ViewJsonModal';
import { ShareModalTabProps } from './types';
import { getTrackingSource } from './utils';

interface Props extends ShareModalTabProps {}

export const ShareExport = memo(({ dashboard, panel, onDismiss }: Props) => {
  const [shareExternally, setShareExternally] = useState(false);
  const [showExportToRepositoryDrawer, setShowExportToRepositoryDrawer] = useState(false);
  const exporter = useMemo(() => new DashboardExporter(), []);
  const provisioningEnabled = config.featureToggles.provisioning;
  const isUnmanaged = !dashboard.meta.provisioned;

  const onShareExternallyChange = () => setShareExternally((prev) => !prev);

  const onSaveAsFile = () => {
    DashboardInteractions.exportSaveJsonClicked({
      externally: shareExternally,
      shareResource: getTrackingSource(panel),
    });

    if (shareExternally) {
      makeExportableV1(dashboard).then((dashboardJson) => {
        if ('error' in dashboardJson) {
          console.error('Failed to export dashboard:', dashboardJson.error);
          return;
        }
        openSaveAsDialog(dashboardJson as Record<string, unknown> & { title?: string });
      });
    } else {
      openSaveAsDialog(dashboard.getSaveModelClone() as Record<string, unknown> & { title?: string });
    }
  };

  const onViewJson = () => {
    DashboardInteractions.exportViewJsonClicked({
      externally: shareExternally,
      shareResource: getTrackingSource(panel),
    });

    if (shareExternally) {
      exporter.makeExportable(dashboard).then((dashboardJson) => {
        openJsonModal(dashboardJson);
      });
    } else {
      openJsonModal(dashboard.getSaveModelClone());
    }
  };

  const openSaveAsDialog = (dash: unknown) => {
    const dashboardJsonPretty = JSON.stringify(dash, null, 2);
    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });
    const time = new Date().getTime();
    const title =
      typeof dash === 'object' && dash !== null && 'title' in dash && typeof dash.title === 'string'
        ? dash.title
        : 'dashboard';
    saveAs(blob, `${title}-${time}.json`);
  };

  const openJsonModal = (clone: object) => {
    appEvents.publish(
      new ShowModalReactEvent({
        props: {
          json: JSON.stringify(clone, null, 2),
        },
        component: ViewJsonModal,
      })
    );

    onDismiss?.();
  };

  const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);

  return (
    <>
      <p>
        <Trans i18nKey="share-modal.export.info-text">Export this dashboard.</Trans>
      </p>
      <Field label={exportExternallyTranslation} noMargin>
        <Switch id="share-externally-toggle" value={shareExternally} onChange={onShareExternallyChange} />
      </Field>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
        </Button>
        {provisioningEnabled && isUnmanaged && (
          <Button variant="secondary" onClick={() => setShowExportToRepositoryDrawer(true)}>
            <Trans i18nKey="share-modal.export.export-to-repository-button">Export to Repository</Trans>
          </Button>
        )}
        <Button variant="secondary" onClick={onViewJson}>
          <Trans i18nKey="share-modal.export.view-button">View JSON</Trans>
        </Button>
        <Button variant="primary" onClick={onSaveAsFile}>
          <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
        </Button>
      </Modal.ButtonRow>
      {showExportToRepositoryDrawer && (
        <Drawer
          title={
            <Text variant="h3" element="h2">
              {t('share-modal.export.export-to-repository-title', 'Export Dashboard to Repository')}
            </Text>
          }
          subtitle={dashboard.title}
          onClose={() => setShowExportToRepositoryDrawer(false)}
          size="md"
        >
          <BulkExportProvisionedResource
            folderUid={dashboard.meta.folderUid}
            selectedItems={{
              dashboard: dashboard.uid ? { [dashboard.uid]: true } : {},
              folder: {},
            }}
            onDismiss={() => {
              setShowExportToRepositoryDrawer(false);
              onDismiss?.();
            }}
          />
        </Drawer>
      )}
    </>
  );
});

ShareExport.displayName = 'ShareExport';
