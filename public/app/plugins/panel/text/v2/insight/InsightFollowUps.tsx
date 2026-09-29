import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { InsightAnswerView } from 'app/features/dashboard-scene/sidebar/insights/InsightAnswerView';
import { openInsightFollowUp } from 'app/features/dashboard-scene/sidebar/insights/followUp';
import { type InsightSourcePanel } from 'app/features/dashboard-scene/sidebar/insights/sources';

import { type FollowUpThread } from './useInsight';

interface Props {
  threads: FollowUpThread[];
  sources: InsightSourcePanel[];
  /** The main question is running, so a follow-up would answer against an answer about to be replaced. */
  disabled: boolean;
  onAsk: (question: string) => void;
}

/**
 * The author's follow-up questions, each answered in place against the same snapshot as the
 * answer above. Unanswered follow-ups stay offered, so the viewer can work through them.
 */
export function InsightFollowUps({ threads, sources, disabled, onAsk }: Props) {
  const styles = useStyles2(getStyles);

  if (threads.length === 0) {
    return null;
  }

  const unanswered = threads.filter((thread) => !thread.result && !thread.running);
  const answered = threads.filter((thread) => thread.result || thread.running || thread.error);

  return (
    <Stack direction="column" gap={1}>
      {unanswered.length > 0 && (
        <Stack direction="column" gap={0.5}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="textng.insight.follow-ups-label">Follow-ups</Trans>
          </Text>
          <Stack direction="row" gap={0.5} wrap="wrap">
            {unanswered.map((thread) => (
              <Button
                key={thread.question}
                size="sm"
                variant="secondary"
                fill="outline"
                disabled={disabled}
                onClick={() => onAsk(thread.question)}
              >
                {thread.question}
              </Button>
            ))}
          </Stack>
        </Stack>
      )}

      {answered.map((thread) => (
        <div key={thread.question} className={styles.thread}>
          <Stack direction="column" gap={1}>
            <Text element="p" weight="medium" variant="bodySmall">
              {thread.question}
            </Text>

            {thread.running && (
              <Stack direction="row" gap={1} alignItems="center">
                <Spinner size="sm" inline />
                <Text variant="bodySmall" color="secondary">
                  <Trans i18nKey="textng.insight.follow-up-running">Answering…</Trans>
                </Text>
              </Stack>
            )}

            {thread.error && (
              <Alert
                severity="error"
                title={t('textng.insight.follow-up-error-title', 'Assistant could not answer')}
                bottomSpacing={0}
              >
                <Stack direction="column" gap={1} alignItems="start">
                  <span>{thread.error}</span>
                  <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onAsk(thread.question)}>
                    <Trans i18nKey="textng.insight.follow-up-retry">Try again</Trans>
                  </Button>
                </Stack>
              </Alert>
            )}

            {thread.result && (
              <InsightAnswerView
                result={thread.result}
                sources={sources}
                onFollowUp={() => openInsightFollowUp(thread.result!, false)}
              />
            )}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    thread: css({
      paddingLeft: theme.spacing(1.5),
      borderLeft: `2px solid ${theme.colors.border.weak}`,
    }),
  };
}
