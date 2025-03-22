import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from 'app/core/internationalization';

import { GenAIButton } from '../../../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../../../dashboard/components/GenAI/utils';
import { RuleFormValues } from '../../types/rule-form';

interface GenAIAlertSummaryButtonProps {
  onGenerate: (summary: string) => void;
}

const SUMMARY_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Alert Rules.\n' +
  'Your goal is to write a short, concise summary for an alert rule.\n' +
  'The summary should briefly explain what happened and why someone should care about it.\n' +
  'Use Grafana alerting templates where appropriate (like $labels, $values, etc.).\n' +
  'Use only existing labels\n' +
  'Keep the summary under 100 characters and make it actionable.\n' +
  'Respond with only the summary text.';

export const GenAIAlertSummaryButton = ({ onGenerate }: GenAIAlertSummaryButtonProps) => {
  const { watch } = useFormContext<RuleFormValues>();
  const name = watch('name');
  const type = watch('type');
  const queries = watch('queries');

  const messages = useMemo(() => {
    const queryModels = queries.map((q) => q.model);
    // Filter out expression queries which have refId property
    const dataQueries = queryModels.filter((q) => !q.refId);

    // Get other important context
    const annotations = watch('annotations') || [];
    const labels = watch('labels') || [];
    const description = annotations.find((a) => a.key === 'description')?.value || '';

    // Format labels and annotations for the prompt
    const labelsText = labels.length > 0 ? `Labels:\n${labels.map((l) => `- ${l.key}: ${l.value}`).join('\n')}\n` : '';

    const annotationsText =
      annotations.length > 0 ? `Annotations:\n${annotations.map((a) => `- ${a.key}: ${a.value}`).join('\n')}\n` : '';

    const messages: Message[] = [
      {
        content: SUMMARY_GENERATION_STANDARD_PROMPT,
        role: Role.system,
      },
      {
        content:
          `Alert Rule Name: ${name}\n` +
          `Alert Rule Type: ${type}\n` +
          `${description}\n` +
          `${labelsText}` +
          `${annotationsText}` +
          `Queries: ${JSON.stringify(dataQueries, null, 2)}\n` +
          `Examples of Grafana templates:\n` +
          `1. CPU usage on {{ $labels.instance }} is high ({{ $value }}%)\n` +
          `2. Memory usage exceeds threshold: {{ $value | humanizePercentage }}\n` +
          `3. Disk I/O on {{ $labels.device }} is {{ $value | humanize1024 }}/s\n`,
        role: Role.user,
      },
    ];
    return messages;
  }, [name, type, queries, watch]);

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.alertRuleSummary}
      toggleTipTitle={t('alerting.rule-editor.gen-ai.summary-tip-title', 'Improve your alert rule summary')}
      tooltip={t('alerting.rule-editor.gen-ai.summary-tooltip', 'Generate a summary for this alert rule')}
    />
  );
};
