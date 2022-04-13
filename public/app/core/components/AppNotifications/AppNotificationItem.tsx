import React from 'react';
import { AppNotification, AppNotificationSeverity, AppNotificationTimeout } from 'app/types';
import { Alert, useStyles2 } from '@grafana/ui';
import { useEffectOnce } from 'react-use';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

import { capitalize } from 'lodash';

interface Props {
  appNotification: AppNotification;
  onClearNotification: (id: string) => void;
}

export default function AppNotificationItem({ appNotification, onClearNotification }: Props) {
  const styles = useStyles2(getStyles);

  useEffectOnce(() => {
    if (appNotification.severity !== AppNotificationSeverity.Info) {
      setTimeout(() => {
        onClearNotification(appNotification.id);
      }, AppNotificationTimeout[capitalize(appNotification.severity) as 'Success' | 'Warning' | 'Error']);
    }
  });

  return (
    <Alert
      severity={appNotification.severity}
      title={appNotification.title}
      onRemove={() => onClearNotification(appNotification.id)}
      elevated
    >
      <div className={styles.wrapper}>
        <span>{appNotification.component || appNotification.text}</span>
        {appNotification.traceId && <span className={styles.trace}>Trace ID: {appNotification.traceId}</span>}
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
