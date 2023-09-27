import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  feedbackUrl?: string;
}

export function FeedbackLink({ feedbackUrl }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Stack>
      <a
        href={feedbackUrl}
        className={styles.link}
        title="The metrics explorer is new, please let us know how we can improve it"
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
      margin: `-25px 0 30px 0`,
    }),
  };
}
