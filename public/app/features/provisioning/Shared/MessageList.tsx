import { css, cx } from '@emotion/css';
import { SyntheticEvent, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Text, useStyles2 } from '@grafana/ui';

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
      <div className={cx(styles.messageListWrapper, showFull && styles.messageListWrapperExpanded)}>
        <ul className={styles.messageList}>
          {displayMessages.map((msg, index) => (
            <li key={index}>
              {variant ? <Text variant={variant}>{msg}</Text> : msg}
              {!showFull && hasMultipleMessages && index === 0 && (
                <>
                  {' '}
                  <Trans i18nKey="logs.log-row-message.ellipsis">… </Trans>
                  <button className={cx(styles.showMore, styles.showMoreInline)} onClick={handleExpand}>
                    <Trans i18nKey="logs.log-row-message.more">show more</Trans>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      {showFull && hasMultipleMessages && (
        <Box paddingLeft={3} paddingTop={0.5}>
          <button className={styles.showMore} onClick={handleCollapse}>
            <Trans i18nKey="logs.log-line.show-less">show less</Trans>
          </button>
        </Box>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  messageListWrapper: css({
    overflow: 'hidden',
    maxHeight: '200px',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('max-height', {
        duration: theme.transitions.duration.standard,
        easing: theme.transitions.easing.easeInOut,
      }),
    },
  }),
  messageListWrapperExpanded: css({
    maxHeight: '9999px',
  }),
  messageList: css({
    margin: 0,
    paddingLeft: theme.spacing(3),
    listStyle: 'disc',
  }),
  showMore: css({
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    textDecoration: 'underline',
    cursor: 'pointer',
    color: theme.colors.text.primary,
  }),
  showMoreInline: css({
    marginLeft: theme.spacing(0.5),
  }),
});
