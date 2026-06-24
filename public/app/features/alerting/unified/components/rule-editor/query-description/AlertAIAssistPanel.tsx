import { css } from '@emotion/css';

import { type OpenAssistantProps, createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { compileQueryDescription } from './compileQueryDescription';
import { type QuerySummaryInput } from './extractQuerySummaryInput';

interface AlertAIAssistPanelProps {
  summaryInput: QuerySummaryInput | undefined;
  ruleName: string;
  summary: string;
  description: string;
}

const POLISH_PROMPT =
  'Rewrite this alert into a clear, specific summary annotation of one or two sentences that an on-call ' +
  'engineer sees in a notification. Preserve every metric name and numeric threshold exactly. Return only ' +
  'the summary text.';

const REVIEW_PROMPT =
  "Act as a tired on-call engineer woken at 3am by this alert — skeptical and short on patience. Review the " +
  'rule for what is still unclear or missing and would slow you down: no guidance on what to check first, ' +
  'unclear normal-vs-bad ranges, missing runbook, ambiguous severity or ownership, a threshold with no ' +
  'rationale. List the concrete gaps to fix before saving.';

export function AlertAIAssistPanel({ summaryInput, ruleName, summary, description }: AlertAIAssistPanelProps) {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return (
      <div className={styles.panel}>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.ai-assist.unavailable">
            Enable the Grafana Assistant to polish the summary and run an on-call review.
          </Trans>
        </Text>
      </div>
    );
  }

  // Hand the rule's context to the Assistant. Generation happens in the assistant
  // app (no API key here); a follow-up can register a tool to write results back
  // into the form — the context built below is what it would act on.
  const queryEnglish = summaryInput
    ? compileQueryDescription(summaryInput.expr, { threshold: summaryInput.threshold }).text
    : '';

  const buildContext = () => [
    createAssistantContextItem('structured', {
      title: `Alert: ${ruleName || '(unnamed)'}`,
      data: {
        rule: {
          name: ruleName,
          query: summaryInput?.expr ?? '',
          threshold: summaryInput?.threshold
            ? `${summaryInput.threshold.comparator} ${summaryInput.threshold.value}`
            : '',
          firesOn: queryEnglish,
          summary,
          description,
        },
      },
    }),
  ];

  const open = (prompt: string, origin: string) => {
    const props: OpenAssistantProps = {
      origin,
      mode: 'assistant',
      prompt,
      context: buildContext(),
      autoSend: true,
    };
    openAssistant(props);
  };

  return (
    <div className={styles.panel}>
      <Stack direction="row" gap={1} alignItems="center">
        <Button
          type="button"
          variant="secondary"
          icon="ai"
          disabled={!summaryInput}
          onClick={() => open(POLISH_PROMPT, 'alerting/annotations-summary-polish')}
        >
          <Trans i18nKey="alerting.ai-assist.polish">Polish summary with Assistant</Trans>
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon="bug"
          onClick={() => open(REVIEW_PROMPT, 'alerting/annotations-oncall-review')}
        >
          <Trans i18nKey="alerting.ai-assist.review">Review like a tired on-call engineer</Trans>
        </Button>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    borderLeft: `2px solid ${theme.colors.border.medium}`,
    paddingLeft: theme.spacing(1.5),
    marginTop: theme.spacing(0.5),
  }),
});
