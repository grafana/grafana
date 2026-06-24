import { type ChatContextItem, type Question } from '@grafana/assistant';
import { t } from '@grafana/i18n';

export const EXPLAIN_ASSISTANT_QUESTIONS_URL = '/alerting/alerts';

export function buildExplainAssistantQuestions(assistantContext: ChatContextItem[]): Question[] {
  return [
    {
      title: t('alerting.triage.explain.prompt-similar-alerts-title', 'Show me similar alerts'),
      prompt: t(
        'alerting.triage.explain.prompt-similar-alerts',
        'Using the attached alert instance context, find other currently firing or pending alert instances that are similar to this one (same rule, related labels, or comparable symptoms). List up to 10 similar alerts with rule name, labels, and state. If there are several, briefly note what they have in common.'
      ),
      context: assistantContext,
    },
    {
      title: t('alerting.triage.explain.prompt-affected-systems-title', 'Show me the affected systems'),
      prompt: t(
        'alerting.triage.explain.prompt-affected-systems',
        'Using the attached alert instance context, analyze the rule queries and labels to identify the systems, services, or infrastructure components likely affected. Summarize the affected systems as a concise bullet list and explain your reasoning from the query and label data.'
      ),
      context: assistantContext,
    },
    {
      title: t('alerting.triage.explain.prompt-irm-history-title', 'Show me incident/IRM history'),
      prompt: t(
        'alerting.triage.explain.prompt-irm-history',
        'Using the attached alert instance context, look for any incident or IRM-related context linked to this alert rule (for example in rule annotations or metadata). Summarize any incident history you find. If no IRM or incident context is available yet, say so clearly and suggest what the user could check elsewhere.'
      ),
      context: assistantContext,
    },
  ];
}
