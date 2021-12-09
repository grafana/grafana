import React, { ReactElement } from 'react';
import { Button, Modal, useTheme2 } from '@grafana/ui';

import { ShareModalTabProps } from './types';
import { getRequestResponseRecorder } from '../../../../core/services/RequestResponseRecorder';

interface ShareStartRecordingProps extends ShareModalTabProps {}

export function ShareStartRecording({ onDismiss }: ShareStartRecordingProps): ReactElement {
  const theme = useTheme2();
  const onStart = () => {
    if (!getRequestResponseRecorder().isRecording()) {
      getRequestResponseRecorder().start();
      onDismiss?.();
    }
  };

  return (
    <>
      <div>
        <p className="share-modal-info-text">
          Sometimes it is hard to reproduce a issue because of the data used. Recording the requests / responses for the
          dashboard is an instant way to share a dashboard that can be replayed by someone trying to reproduce the
          issue.
        </p>
        <p className="share-modal-info-text">
          Keep in mind, your shared recording will include both the
          <em> dashboard and all the requests / responses including the data</em>.
        </p>
        <p className="share-modal-info-text">Share wisely.</p>
        <p className="share-modal-info-text">Clicking on the Start Recording button will start the recording</p>
        <p className="share-modal-info-text">
          The recording will automatically stop when you navigate away from the dashboard or when you click on the
          record indicator.
        </p>
        <img
          src={theme.isDark ? 'public/img/dark_stop_recording.gif' : 'public/img/light_stop_recording.gif'}
          alt="Stop recording animation"
        />
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button variant="primary" onClick={onStart}>
          Start Recording
        </Button>
      </Modal.ButtonRow>
    </>
  );
}
