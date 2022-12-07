import { css } from '@emotion/css';
// import { useHistory } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { GrafanaTheme2, AppNotificationType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Tag, Card, Checkbox, useTheme2 } from '@grafana/ui';

import { AlertVariant, SystemNotificationsProps } from './SystemNotificationsPage';

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
  // const history = useHistory();
  const theme = useTheme2();
  const styles = getStyles(theme);
  const showTraceId = config.featureToggles.tracing && traceId;

  return (
    <Card className={className} onClick={onClick}>
      {title && (
        <Card.Heading>
          {/* {icon ? (
          <Card.Figure>
            <Icon name={icon} />
            <img
              src={icon}
              alt=""
              height="16px"
              width="16px"
              // className={styles.logo}
            />
            {title}
          </Card.Figure>
        ) : ( */}
          {title}
          {/* )} */}
        </Card.Heading>
      )}
      <Card.Description>{description}</Card.Description>
      <Card.Description>{children}</Card.Description>
      <Card.Figure>
        <Checkbox onChange={onClick} tabIndex={-1} value={isSelected} />
      </Card.Figure>
      <Card.Tags className={styles.trace}>
        {showTraceId && <span>{`Trace ID: ${traceId}`}</span>}
        {timestamp && formatDistanceToNow(timestamp, { addSuffix: true })}
      </Card.Tags>
      {type && (
        <Card.Tags>
          <Tag name={type} colorIndex={getColorFromNotifType(type)} style={{ marginBottom: '12px' }} />
        </Card.Tags>
      )}
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

export default SystemNotificationsItem;

function getColorFromNotifType(type: AppNotificationType): number {
  switch (type) {
    case 'update':
      return 1;
    case 'productAnnouncement':
      return 2;
    case 'permissions':
      return 3;
    case 'access':
      return 4;
    case 'systemMessage':
      return 5;
    default:
      return 6;
  }
}
