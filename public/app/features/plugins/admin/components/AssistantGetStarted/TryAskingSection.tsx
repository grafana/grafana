import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { type AssistantOpenOverrides } from './constants';

export function TryAskingSection({
  onOpenAssistant,
  disabled,
}: {
  onOpenAssistant: (props?: AssistantOpenOverrides) => void;
  disabled?: boolean;
}) {
  const styles = useStyles2(getStyles);

  const queries = [
    t('plugins.assistant-get-started.try-asking.query-datasources', 'What data sources do I have?'),
    t('plugins.assistant-get-started.try-asking.query-cpu', 'Show me CPU usage across my hosts'),
    t('plugins.assistant-get-started.try-asking.query-dashboard', 'Create a dashboard for my database'),
    t('plugins.assistant-get-started.try-asking.query-promql', 'Help me write a PromQL query for error rate'),
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h3" variant="h5" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.try-asking.heading">Try asking:</Trans>
      </Text>
      <div className={styles.tryQueriesGrid}>
        {queries.map((query) => (
          <button
            key={query}
            type="button"
            className={styles.tryQueryButton}
            disabled={disabled}
            onClick={() => onOpenAssistant({ prompt: query, autoSend: true })}
          >
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name="comment-alt" />
              <Text>{query}</Text>
            </Stack>
          </button>
        ))}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tryQueriesGrid: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    [theme.breakpoints.down('xl')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  tryQueryButton: css({
    alignItems: 'center',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    padding: theme.spacing(2),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      background: theme.colors.background.primary,
      borderColor: theme.colors.border.medium,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  }),
});
