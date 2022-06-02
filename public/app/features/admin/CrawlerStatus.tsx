import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Button, useTheme2 } from '@grafana/ui';

import { CrawlerStartButton } from './CrawlerStartButton';

interface CrawlerStatusMessage {
  state: string;
  started: string;
  finished: string;
  complete: number;
  queue: number;
  last: string;
}

export const CrawlerStatus = () => {
  const styles = getStyles(useTheme2());
  const [status, setStatus] = useState<CrawlerStatusMessage>();

  useEffect(() => {
    const subscription = getGrafanaLiveSrv()
      .getStream<CrawlerStatusMessage>({
        scope: LiveChannelScope.Grafana,
        namespace: 'broadcast',
        path: 'crawler',
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
        No status (never run)
        <br />
        <CrawlerStartButton />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <pre>{JSON.stringify(status, null, 2)}</pre>
      {status.state !== 'running' && <CrawlerStartButton />}
      {status.state !== 'stopped' && (
        <Button
          variant="secondary"
          onClick={() => {
            getBackendSrv().post('/api/admin/crawler/stop');
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
