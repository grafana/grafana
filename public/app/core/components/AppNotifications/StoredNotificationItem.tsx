import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import { ReactNode, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, Checkbox, IconButton, Tooltip, useTheme2 } from '@grafana/ui';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface Props {
  children?: ReactNode;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  severity?: AlertVariant;
  title: string;
  text?: string;
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
  text,
  traceId,
  timestamp,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const parts: string[] = [];
    parts.push(`Title: ${title}`);
    if (text) {
      parts.push(`Message: ${text}`);
    }
    if (traceId) {
      parts.push(`Trace ID: ${traceId}`);
    }
    if (timestamp) {
      const date = new Date(timestamp);
      parts.push(`Timestamp: ${date.toISOString()}`);
    }
    const textToCopy = parts.join('\n');

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <Card noMargin className={className} onClick={onClick}>
      <Card.Heading>{title}</Card.Heading>
      <Card.Description>{children}</Card.Description>
      <Card.Figure>
        <Checkbox onChange={onClick} tabIndex={-1} value={isSelected} />
      </Card.Figure>
      <Card.Tags className={styles.trace}>
        {traceId && <span>{`Trace ID: ${traceId}`}</span>}
        {timestamp && formatDistanceToNow(timestamp, { addSuffix: true })}
      </Card.Tags>
      <Card.SecondaryActions>
        <Tooltip
          content={
            hasCopied
              ? t('notifications.stored-notification-item.copied', 'Copied')
              : t('notifications.stored-notification-item.copy-to-clipboard', 'Copy to clipboard')
          }
        >
          <IconButton
            name="copy"
            onClick={handleCopy}
            aria-label={t('notifications.stored-notification-item.copy-to-clipboard', 'Copy to clipboard')}
          />
        </Tooltip>
      </Card.SecondaryActions>
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
