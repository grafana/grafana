// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/FeedbackLink.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, useStyles2, Stack } from '@grafana/ui';

interface Props {
  feedbackUrl?: string;
}

export function FeedbackLink({ feedbackUrl }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Stack>
      <a
        href={feedbackUrl}
        className={styles.link}
        title={t(
          'grafana-prometheus.querybuilder.feedback-link.title-give-feedback',
          'The metrics explorer is new, please let us know how we can improve it'
        )}
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" />{' '}
        <Trans i18nKey="grafana-prometheus.querybuilder.feedback-link.give-feedback">Give feedback</Trans>
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
