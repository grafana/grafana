import { css } from '@emotion/css';
import { useEffectOnce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';
import { AppNotification, timeoutMap } from 'app/types/appNotifications';

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

  const hasBody = appNotification.component || appNotification.text || appNotification.traceId;
  const traceId = appNotification.traceId;

  return (
    <Alert
      severity={appNotification.severity}
      title={appNotification.title}
      onRemove={() => onClearNotification(appNotification.id)}
      elevated
    >
      {hasBody && (
        <div className={styles.wrapper}>
          <span>{appNotification.component || appNotification.text}</span>
          {traceId && (
            <span className={styles.trace}>
              <Trans i18nKey="app-notification.item.trace-id">Trace ID: {{ traceId }}</Trans>
            </span>
          )}
        </div>
      )}
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
