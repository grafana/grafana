import React, { ReactElement } from 'react';
import { Button, Modal } from '@grafana/ui/src';
import { saveAs } from 'file-saver';

import { ShareModalTabProps } from './types';
import { DashboardExporter } from '../DashExportModal';
import { RequestResponseRecording } from '../../../../core/services/RequestResponseRecorder';
import { DASHBOARD_EXPORTER_RECORDINGS } from '../DashExportModal/constants';

interface ShareRecordingsProps extends ShareModalTabProps {
  recordings: RequestResponseRecording[];
}

export function ShareRecordings({ onDismiss, dashboard, recordings }: ShareRecordingsProps): ReactElement {
  const openSaveAsDialog = (exportedDashboard: Record<string, any>) => {
    const dashboardJsonPretty = JSON.stringify(exportedDashboard, null, 2);
    const blob = new Blob([dashboardJsonPretty], { type: 'application/json;charset=utf-8' });
    const time = new Date().getTime();
    saveAs(blob, `${exportedDashboard.title}-${time}.json`);
  };

  const onSaveAsFile = async () => {
    try {
      const exporter = new DashboardExporter();
      const exportedDashboard: Record<string, any> = await exporter.makeExportable(dashboard);
      exportedDashboard[DASHBOARD_EXPORTER_RECORDINGS] = recordings;
      openSaveAsDialog(exportedDashboard);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <p className="share-modal-info-text">Export this dashboard with recorded requests/responses.</p>
      <p className="share-modal-info-text">
        Keep in mind, your shared recording will include both the
        <em> dashboard and all the requests / responses including the data</em>.
      </p>
      <p className="share-modal-info-text">Share wisely.</p>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button variant="primary" onClick={onSaveAsFile}>
          Save to file
        </Button>
      </Modal.ButtonRow>
    </>
  );
}
