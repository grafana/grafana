import { saveAs } from 'file-saver';
import { memo, useState, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Modal, Switch } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal/DashboardExporter';
import { makeExportableV1 } from 'app/features/dashboard-scene/scene/export/exporters';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { ShowModalReactEvent } from 'app/types/events';

import { ViewJsonModal } from './ViewJsonModal';
import { ShareModalTabProps } from './types';
import { getTrackingSource } from './utils';

interface Props extends ShareModalTabProps {}

export const ShareExport = memo(({ dashboard, panel, onDismiss }: Props) => {
  const [shareExternally, setShareExternally] = useState(false);
  const exporter = useMemo(() => new DashboardExporter(), []);

  const onShareExternallyChange = () => setShareExternally((prev) => !prev);

  const onSaveAsFile = () => {
    DashboardInteractions.exportSaveJsonClicked({
      externally: shareExternally,
      shareResource: getTrackingSource(panel),
    });

    if (shareExternally) {
      makeExportableV1(dashboard).then((dashboardJson) => {
        openSaveAsDialog(dashboardJson);
      });
    } else {
      openSaveAsDialog(dashboard.getSaveModelClone());
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

  const openSaveAsDialog = (dash: any) => {
    const dashboardJsonPretty = JSON.stringify(dash, null, 2);
    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });
    const time = new Date().getTime();
    saveAs(blob, `${dash.title}-${time}.json`);
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
      <Field label={exportExternallyTranslation}>
        <Switch id="share-externally-toggle" value={shareExternally} onChange={onShareExternallyChange} />
      </Field>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
        </Button>
        <Button variant="secondary" onClick={onViewJson}>
          <Trans i18nKey="share-modal.export.view-button">View JSON</Trans>
        </Button>
        <Button variant="primary" onClick={onSaveAsFile}>
          <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
});

ShareExport.displayName = 'ShareExport';
