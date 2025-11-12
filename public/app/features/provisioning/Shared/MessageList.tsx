import { css, cx } from '@emotion/css';
import { useState } from 'react';

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

  const handleExpand = () => {
    setShowFull(true);
  };

  const handleCollapse = () => {
    setShowFull(false);
  };

  const displayMessages = showFull ? messages : messages.slice(0, 1);

  return (
    <>
      <div className={cx(styles.messageListWrapper, { [styles.messageListWrapperExpanded]: showFull })}>
        <ul className={styles.messageList}>
          {displayMessages.map((msg, index) => (
            <li key={index}>
              {variant ? <Text variant={variant}>{msg}</Text> : msg}
              {!showFull && hasMultipleMessages && index === 0 && (
                <>
                  {' '}
                  <span aria-hidden="true">… </span>
                  <span className="sr-only">
                    <Trans i18nKey="provisioning.message.truncated">Message truncated</Trans>
                  </span>
                  <button
                    type="button"
                    className={cx(styles.showMore, styles.showMoreInline)}
                    onClick={handleExpand}
                    aria-expanded={false}
                  >
                    <Trans i18nKey="provisioning.message.show-more">show more</Trans>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      {showFull && hasMultipleMessages && (
        <Box paddingLeft={3} paddingTop={0.5}>
          <button type="button" className={styles.showMore} onClick={handleCollapse} aria-expanded={true}>
            <Trans i18nKey="provisioning.message.show-less">show less</Trans>
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
