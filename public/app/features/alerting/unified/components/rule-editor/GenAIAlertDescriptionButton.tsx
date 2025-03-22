import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from 'app/core/internationalization';

import { GenAIButton } from '../../../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../../../dashboard/components/GenAI/utils';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';

interface GenAIAlertDescriptionButtonProps {
  onGenerate: (description: string) => void;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Alert Rules.\n' +
  'Your goal is to write a descriptive and concise alert rule description.\n' +
  'The description should explain the purpose of the alert rule, what it monitors, and why someone should care about it.\n' +
  'The description should not be overly technical and should be understandable by someone who is not familiar with the system.\n' +
  'Keep the description under 300 characters.\n' +
  'Respond with only the description of the alert rule.';

export const GenAIAlertDescriptionButton = ({ onGenerate }: GenAIAlertDescriptionButtonProps) => {
  const { watch } = useFormContext<RuleFormValues>();
  const name = watch('name');
  const type = watch('type');
  const annotations = watch('annotations');
  const queries = watch('queries');

  // Get the summary annotation if it exists
  const summary = annotations.find((annotation) => annotation.key === Annotation.summary)?.value || '';

  const messages = useMemo(() => {
    const queryModels = queries.map((q) => q.model);
    // Filter out expression queries which have refId property
    const dataQueries = queryModels.filter((q) => !q.refId);

    // Get other important context
    const labels = watch('labels') || [];

    // Format labels and annotations for the prompt
    const labelsText = labels.length > 0 ? `Labels:\n${labels.map((l) => `- ${l.key}: ${l.value}`).join('\n')}\n` : '';

    const annotationsText =
      annotations.length > 0
        ? `Annotations:\n${annotations
            .filter((a) => a.key !== Annotation.description)
            .map((a) => `- ${a.key}: ${a.value}`)
            .join('\n')}\n`
        : '';

    const messages: Message[] = [
      {
        content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
        role: Role.system,
      },
      {
        content:
          `Alert Rule Name: ${name}\n` +
          `Alert Rule Type: ${type}\n` +
          `Alert Rule Summary: ${summary}\n` +
          `${labelsText}` +
          `${annotationsText}` +
          `Queries: ${JSON.stringify(dataQueries, null, 2)}\n`,
        role: Role.user,
      },
    ];
    return messages;
  }, [name, type, summary, annotations, queries, watch]);

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.alertRuleDescription}
      toggleTipTitle={t('alerting.rule-editor.gen-ai.description-tip-title', 'Improve your alert rule description')}
      tooltip={t('alerting.rule-editor.gen-ai.description-tooltip', 'Generate a description for this alert rule')}
    />
  );
};
