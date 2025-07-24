import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

interface MessageListProps {
  messages: string[];
  variant?: 'body' | 'bodySmall';
}

export function MessageList({ messages, variant }: MessageListProps) {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.messageList}>
      {messages.map((msg, index) => (
        <li key={index}>{variant ? <Text variant={variant}>{msg}</Text> : msg}</li>
      ))}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  messageList: css({
    margin: 0,
    paddingLeft: theme.spacing(3),
  }),
});
