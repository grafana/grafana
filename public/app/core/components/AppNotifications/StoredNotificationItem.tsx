import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, IconButton, IconName, useTheme2 } from '@grafana/ui';
import { getIconFromSeverity } from '@grafana/ui/src/components/Alert/Alert';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props {
  title: string;
  severity?: AlertVariant;
  timestamp?: number;
  traceId?: string;
  children?: ReactNode;
  onRemove?: (event: React.MouseEvent) => void;
}

export const StoredNotificationItem = ({
  title,
  severity = 'error',
  traceId,
  timestamp,
  children,
  onRemove,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, severity);
  const showTraceId = config.featureToggles.tracing && traceId;

  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>
        <Icon size="xl" name={getIconFromSeverity(severity) as IconName} />
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{children}</div>
      <span className={styles.trace}>{showTraceId && `Trace ID: ${traceId}`}</span>
      <div className={styles.close}>
        <IconButton aria-label="Close alert" name="times" onClick={onRemove} size="lg" type="button" />
      </div>
      {timestamp && <span className={styles.timestamp}>{formatDistanceToNow(timestamp, { addSuffix: true })}</span>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, severity: AlertVariant) => {
  const color = theme.colors[severity];
  const borderRadius = theme.shape.borderRadius();

  return {
    wrapper: css({
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gridTemplateRows: 'auto 1fr auto',
      gridTemplateAreas: `
        'icon title close'
        'icon body body'
        'icon trace timestamp'`,
      gap: `0 ${theme.spacing(2)}`,
      background: theme.colors.background.secondary,
      borderRadius: borderRadius,
    }),
    icon: css({
      gridArea: 'icon',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(2, 3),
      background: color.main,
      color: color.contrastText,
      borderRadius: `${borderRadius} 0 0 ${borderRadius}`,
    }),
    title: css({
      gridArea: 'title',
      alignSelf: 'center',
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    body: css({
      gridArea: 'body',
      maxHeight: '50vh',
      marginRight: theme.spacing(1),
      overflowY: 'auto',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      color: theme.colors.text.secondary,
    }),
    trace: css({
      gridArea: 'trace',
      justifySelf: 'start',
      alignSelf: 'end',
      paddingBottom: theme.spacing(1),
      fontSize: theme.typography.pxToRem(10),
      color: theme.colors.text.secondary,
    }),
    close: css({
      gridArea: 'close',
      display: 'flex',
      justifySelf: 'end',
      padding: theme.spacing(1, 0.5),
      background: 'none',
    }),
    timestamp: css({
      gridArea: 'timestamp',
      alignSelf: 'end',
      padding: theme.spacing(1),
      fontSize: theme.typography.pxToRem(10),
      color: theme.colors.text.secondary,
    }),
  };
};
