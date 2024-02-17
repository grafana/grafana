import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  feedbackUrl?: string;
}

export function LogsFeedback({ feedbackUrl }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <Stack>
      <a
        href={feedbackUrl}
        className={styles.link}
        title="The logs table is new, please let us know how we can improve it"
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" /> Give feedback
      </a>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    link: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      ':hover': {
        color: theme.colors.text.link,
      },
    }),
  };
}
