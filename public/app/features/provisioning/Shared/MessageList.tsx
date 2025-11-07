import { css } from '@emotion/css';
import { SyntheticEvent, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

interface MessageListProps {
  messages: string[];
  variant?: 'body' | 'bodySmall';
}

export function MessageList({ messages, variant }: MessageListProps) {
  const styles = useStyles2(getStyles);
  const [showFull, setShowFull] = useState(false);
  const hasMultipleMessages = messages.length > 1;

  const handleExpand = (e: SyntheticEvent) => {
    e.stopPropagation();
    setShowFull(true);
  };

  const handleCollapse = (e: SyntheticEvent) => {
    e.stopPropagation();
    setShowFull(false);
  };

  const displayMessages = showFull ? messages : messages.slice(0, 1);

  return (
    <>
      <ul className={styles.messageList}>
        {displayMessages.map((msg, index) => (
          <li key={index}>
            {variant ? <Text variant={variant}>{msg}</Text> : msg}
            {!showFull && hasMultipleMessages && index === 0 && (
              <>
                {' '}
                <Trans i18nKey="logs.log-row-message.ellipsis">… </Trans>
                <Button
                  variant="secondary"
                  size="sm"
                  fill="outline"
                  onClick={handleExpand}
                  className={styles.showMoreInline}
                >
                  <Trans i18nKey="logs.log-row-message.more">more</Trans>
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {showFull && hasMultipleMessages && (
        <div className={styles.showMoreContainer}>
          <Button variant="secondary" size="sm" fill="outline" onClick={handleCollapse}>
            <Trans i18nKey="logs.log-line.show-less">show less</Trans>
          </Button>
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  messageList: css({
    margin: 0,
    paddingLeft: theme.spacing(3),
    listStyle: 'disc',
  }),
  showMoreInline: css({
    display: 'inline-flex',
    marginLeft: theme.spacing(0.5),
    verticalAlign: 'middle',
  }),
  showMoreContainer: css({
    paddingLeft: theme.spacing(3),
    marginTop: theme.spacing(0.5),
  }),
});
