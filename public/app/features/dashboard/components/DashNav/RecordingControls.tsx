import React, { ReactElement, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useInterval } from 'react-use';
import { Badge, Modal, useForceUpdate } from '@grafana/ui';
import {
  getRequestResponseRecorder,
  RequestResponseRecording,
} from '../../../../core/services/RequestResponseRecorder';
import { RecordingIndicator } from './RecordingIndicator';
import { createWarningNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from 'app/core/actions';
import { DashboardModel } from '../../state';

const REMINDER_INTERVAL = 5000;
export interface RecordingControlsProps {
  dashboard: DashboardModel;
}

export function RecordingControls({ dashboard }: RecordingControlsProps): ReactElement {
  const [recordings, set] = useState<RequestResponseRecording[]>([]);
  const forceUpdate = useForceUpdate();
  const dispatch = useDispatch();

  useInterval(
    () => {
      dispatch(notifyApp(createWarningNotification('Recording is still in progress')));
    },
    getRequestResponseRecorder().isRecording() ? REMINDER_INTERVAL : null
  );

  const onRecordingStopped = () => {
    const recordings = getRequestResponseRecorder().stop();
    set(recordings);
    forceUpdate();
  };

  return (
    <>
      {dashboard.isRecorded && <Badge text="Recorded dashboard" color="blue" />}
      {!dashboard.isRecorded && getRequestResponseRecorder().isRecording() && (
        <RecordingIndicator onClick={onRecordingStopped} />
      )}
      {!dashboard.isRecorded && !getRequestResponseRecorder().isRecording() && (
        <Modal isOpen={Boolean(recordings.length)} title="Export dashboard with recordings" onDismiss={() => set([])}>
          {/*<ShareExport shareExternally={true} recordings={recordings} dashboard={dashboard} onDismiss={() => set([])} />*/}
        </Modal>
      )}
    </>
  );
}
