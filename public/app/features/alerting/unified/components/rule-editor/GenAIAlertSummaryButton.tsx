import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from 'app/core/internationalization';

import { RuleFormValues } from '../../types/rule-form';
import { GenAIButton, Message, Role } from './GenAIButton';

interface GenAIAlertSummaryButtonProps {
  onGenerate: (summary: string) => void;
}

const SUMMARY_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Alert Rules.\n' +
  'Your goal is to write a short, concise summary for an alert rule.\n' +
  'The summary should briefly explain what happened and why someone should care about it.\n' +
  'IMPORTANT: Only use official Grafana alerting template variables: $labels, $values, $value, $expr, $humanizeValue, $humanizeDuration.\n' +
  'DO NOT create variables that do not exist like $valueInt, $valueString, etc.\n' +
  'For labels, always use the format {{ $labels.labelname }} with double curly braces.\n' +
  'For values, use {{ $value }} or {{ $value | formatter }} with double curly braces,' +
  'or use {{ .Value.<refID>.Value }} where redID is the refID from the queries.\n' +
  'Use only existing labels that you can see in the provided label information.\n' +
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
          `Examples of VALID Grafana template usage:\n` +
          `1. CPU usage on {{ $labels.instance }} is high ({{ $value }}%)\n` +
          `2. Memory usage exceeds threshold: {{ $value | humanizePercentage }}\n` +
          `3. Disk I/O on {{ $labels.device }} is {{ $value | humanize1024 }}/s\n` +
          `4. Service {{ $labels.service }} has high error rate: {{ $value }}\n` +
          `5. Network usage above threshold: {{ $value | humanizeBytes }}\n`,
        role: Role.user,
      },
    ];
    return messages;
  }, [name, type, queries, watch]);

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      toggleTipTitle={t('alerting.rule-editor.gen-ai.summary-tip-title', 'Improve your alert rule summary')}
      tooltip={t('alerting.rule-editor.gen-ai.summary-tooltip', 'Generate a summary for this alert rule')}
    />
  );
};
