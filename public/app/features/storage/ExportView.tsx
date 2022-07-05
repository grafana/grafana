import React, { useEffect, useState } from 'react';

import { isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Button, CodeEditor, Modal } from '@grafana/ui';

import { StorageView } from './types';

interface ExportStatusMessage {
  running: boolean;
  target: string;
  started: number;
  finished: number;
  update: number;
  count: number;
  current: number;
  last: string;
  status: string;
}

interface Props {
  onPathChange: (p: string, v?: StorageView) => void;
}

export const ExportView = ({ onPathChange }: Props) => {
  const [status, setStatus] = useState<ExportStatusMessage>();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState({
    format: 'git',
    git: {},
  });
  const onDismiss = () => setOpen(false);
  const doStart = () => {
    getBackendSrv()
      .post('/api/admin/export', body)
      .then((v) => {
        onDismiss();
      });
  };

  useEffect(() => {
    const subscription = getGrafanaLiveSrv()
      .getStream<ExportStatusMessage>({
        scope: LiveChannelScope.Grafana,
        namespace: 'broadcast',
        path: 'export',
      })
      .subscribe({
        next: (evt) => {
          if (isLiveChannelMessageEvent(evt)) {
            setStatus(evt.message);
          } else if (isLiveChannelStatusEvent(evt)) {
            setStatus(evt.message);
          }
        },
      });

    // if not running, open the thread
    setTimeout(() => {
      if (!status) {
        setOpen(true);
      }
    }, 500);

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderButton = () => {
    return (
      <>
        <Modal title={'Export grafana instance'} isOpen={open} onDismiss={onDismiss}>
          <div>
            <CodeEditor
              height={200}
              value={JSON.stringify(body, null, 2) ?? ''}
              showLineNumbers={false}
              readOnly={false}
              language="json"
              showMiniMap={false}
              onBlur={(text: string) => {
                setBody(JSON.parse(text)); // force JSON?
              }}
            />
          </div>
          <Modal.ButtonRow>
            <Button onClick={doStart}>Start</Button>
            <Button variant="secondary" onClick={onDismiss}>
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>

        <Button onClick={() => setOpen(true)} variant="primary">
          Export
        </Button>
        <Button variant="secondary" onClick={() => onPathChange('/')}>
          Cancel
        </Button>
      </>
    );
  };

  if (!status) {
    return <div>{renderButton()}</div>;
  }

  return (
    <div>
      <pre>{JSON.stringify(status, null, 2)}</pre>
      {Boolean(!status.running) && renderButton()}
      {Boolean(status.running) && (
        <Button
          variant="secondary"
          onClick={() => {
            getBackendSrv().post('/api/admin/export/stop');
          }}
        >
          Stop
        </Button>
      )}
    </div>
  );
};
