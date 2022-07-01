import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Button, CodeEditor, Modal, useTheme2 } from '@grafana/ui';

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

export const ExportView = () => {
  const styles = getStyles(useTheme2());
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
        console.log('GOT', v);
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
          <div className={styles.wrap}>
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
      </>
    );
  };

  if (!status) {
    return <div className={styles.wrap}>{renderButton()}</div>;
  }

  return (
    <div className={styles.wrap}>
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      //  border: 4px solid red;
    `,
    running: css`
      // border: 4px solid green;
    `,
  };
};
