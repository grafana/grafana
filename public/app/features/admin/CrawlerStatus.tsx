import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { Button, useTheme2 } from '@grafana/ui';
import {
  formattedValueToString,
  getValueFormat,
  GrafanaTheme2,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelScope,
} from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { DashboardSectionItem } from '../search/types';
import { CrawlerStartButton } from './CrawlerStartButton';

interface CrawlerStatusMessage<T = DashboardSectionItem> {
  state: 'initializing' | 'running' | 'done' | 'cancelled';
  theme: 'light' | 'dark';
  time: {
    now: number;
    started: number;
    finished?: number;
    last?: number; // end time for last item
  };
  count: number;
  index: number;
  lastItemMS: number;
  lastItem?: T;
  counter: {
    networkRequests: number;
    oldSchemas: number;
  };
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

  if (status.state === 'running') {
    const delay = Date.now() - status.time.now;
    if (delay > 10000) {
      return (
        <div className={styles.wrap}>
          <h2>Old message: {delay}</h2>
          {JSON.stringify(status)}
        </div>
      );
    }
    const uptime = (status.time.now - status.time.started) / 1000;
    const percent = (status.index + 1) / status.count;

    const fmtSec = getValueFormat('s');
    const fmtPer = getValueFormat('percentunit');

    return (
      <div className={styles.running}>
        {status.lastItem && (
          <img style={{ float: 'right' }} src={`/preview/dash/${status.lastItem.uid}/thumb/${status.theme}`} />
        )}
        <h2>
          {formattedValueToString(fmtPer(percent))} :: {formattedValueToString(fmtSec(uptime))}
        </h2>
        {JSON.stringify(status)}
        <br />

        <Button
          variant="secondary"
          onClick={() => {
            getBackendSrv().post('/api/admin/crawler/stop');
          }}
        >
          Stop
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {JSON.stringify(status)}
      <br />
      <CrawlerStartButton />
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
