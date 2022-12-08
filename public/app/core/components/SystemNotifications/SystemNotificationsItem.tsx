import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { isIconName } from '@grafana/data/src/types/icon';
import { config } from '@grafana/runtime';
import { Tag, Card, Checkbox, useTheme2 } from '@grafana/ui';
import { Icon } from '@grafana/ui/src/components/Icon/Icon';
import { tagColorMap } from 'app/types';

import { SystemNotificationsProps } from './SystemNotificationsPage';

export const SystemNotificationsItem = ({
  children,
  className,
  isSelected,
  onClick,
  severity = 'error',
  title,
  description,
  icon,
  type,
  traceId,
  timestamp,
}: SystemNotificationsProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const showTraceId = config.featureToggles.tracing && traceId;

  return (
    <Card className={className} onClick={onClick}>
      {title && (
        <Card.Heading>
          {icon ? (
            <span>
              {isIconName(icon) ? (
                <Icon name={icon} size="md" style={{ marginRight: '8px', verticalAlign: 'text-top' }} />
              ) : (
                <img src={icon} alt="" height="20px" width="20px" className={styles.logo} />
              )}

              {title}
            </span>
          ) : (
            { title }
          )}
        </Card.Heading>
      )}
      <Card.Description>{description}</Card.Description>
      <Card.Description>{children}</Card.Description>
      <Card.Figure>
        <Checkbox onChange={onClick} tabIndex={-1} value={isSelected} />
      </Card.Figure>
      <Card.Tags className={styles.trace}>
        {type && <Tag name={type} colorIndex={tagColorMap[type]} style={{ marginBottom: '12px' }} />}
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
    logo: css({
      objectFit: 'contain',
      marginRight: '8px',
    }),
  };
};

export default SystemNotificationsItem;
