import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Card, Checkbox, useTheme2 } from '@grafana/ui';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props {
  children?: ReactNode;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  severity?: AlertVariant;
  title: string;
  timestamp?: number;
  traceId?: string;
}

export const StoredNotificationItem = ({
  children,
  className,
  isSelected,
  onClick,
  severity = 'error',
  title,
  traceId,
  timestamp,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const showTraceId = config.featureToggles.tracing && traceId;

  return (
    <Card className={className} onClick={onClick}>
      <Card.Heading>{title}</Card.Heading>
      <Card.Description>{children}</Card.Description>
      <Card.Figure>
        <Checkbox onChange={onClick} tabIndex={-1} value={isSelected} />
      </Card.Figure>
      <Card.Tags className={styles.trace}>
        {showTraceId && <span>{`Trace ID: ${traceId}`}</span>}
        {timestamp && formatDistanceToNow(timestamp, { addSuffix: true })}
      </Card.Tags>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    trace: css({
      alignItems: 'flex-end',
      alignSelf: 'flex-end',
      color: theme.colors.text.secondary,
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.pxToRem(10),
      justifySelf: 'flex-end',
    }),
  };
};
