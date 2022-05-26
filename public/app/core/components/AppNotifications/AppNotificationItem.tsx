import { css } from '@emotion/css';
import React from 'react';
import { useEffectOnce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';
import { AppNotification, timeoutMap } from 'app/types';

interface Props {
  appNotification: AppNotification;
  onClearNotification: (id: string) => void;
}

export default function AppNotificationItem({ appNotification, onClearNotification }: Props) {
  const styles = useStyles2(getStyles);

  useEffectOnce(() => {
    setTimeout(() => {
      onClearNotification(appNotification.id);
    }, timeoutMap[appNotification.severity]);
  });

  const showTraceId = config.featureToggles.tracing && appNotification.traceId;

  return (
    <Alert
      severity={appNotification.severity}
      title={appNotification.title}
      onRemove={() => onClearNotification(appNotification.id)}
      elevated
    >
      <div className={styles.wrapper}>
        <span>{appNotification.component || appNotification.text}</span>
        {showTraceId && <span className={styles.trace}>Trace ID: {appNotification.traceId}</span>}
      </div>
    </Alert>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    trace: css({
      fontSize: theme.typography.pxToRem(10),
    }),
  };
}
