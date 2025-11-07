import { css } from '@emotion/css';
import { SyntheticEvent, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

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
                <button className={styles.showMoreInline} onClick={handleExpand}>
                  <Trans i18nKey="logs.log-row-message.more">show more</Trans>
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {showFull && hasMultipleMessages && (
        <div className={styles.showMoreContainer}>
          <button className={styles.showMore} onClick={handleCollapse}>
            <Trans i18nKey="logs.log-line.show-less">show less</Trans>
          </button>
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
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    marginLeft: theme.spacing(0.5),
    textDecoration: 'underline',
    cursor: 'pointer',
    color: theme.colors.text.primary,
    fontFamily: 'inherit',
    fontSize: 'inherit',
  }),
  showMoreContainer: css({
    paddingLeft: theme.spacing(3),
    marginTop: theme.spacing(0.5),
  }),
  showMore: css({
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    textDecoration: 'underline',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: theme.colors.text.primary,
  }),
});
