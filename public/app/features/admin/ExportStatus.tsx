import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Button, useTheme2 } from '@grafana/ui';

import { ExportStartButton } from './ExportStartButton';

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

export const ExportStatus = () => {
  const styles = getStyles(useTheme2());
  const [status, setStatus] = useState<ExportStatusMessage>();

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
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!status) {
    return (
      <div className={styles.wrap}>
        <ExportStartButton />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <pre>{JSON.stringify(status, null, 2)}</pre>
      {Boolean(!status.running) && <ExportStartButton />}
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
      border: 4px solid red;
    `,
    running: css`
      border: 4px solid green;
    `,
  };
};
