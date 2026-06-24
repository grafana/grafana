import { type ChatContextItem, type Question } from '@grafana/assistant';
import { t } from '@grafana/i18n';

export const EXPLAIN_ASSISTANT_QUESTIONS_URL = '/alerting/alerts';

export interface ExplainAssistantQuestionsOptions {
  /** When false, the IRM/incident history suggestion is omitted entirely. */
  includeIncidentHistoryPrompt?: boolean;
  /** When true, use the prompt that expects linked incident metadata in context. */
  hasLinkedIncidentHistory?: boolean;
}

export function buildExplainAssistantQuestions(
  assistantContext: ChatContextItem[],
  options: ExplainAssistantQuestionsOptions = {}
): Question[] {
  const { includeIncidentHistoryPrompt = false, hasLinkedIncidentHistory = false } = options;

  const questions: Question[] = [
    {
      title: t('alerting.triage.explain.prompt-similar-alerts-title', 'Show me similar alerts'),
      prompt: t(
        'alerting.triage.explain.prompt-similar-alerts',
        'Using the attached alert instance context, find up to 10 alert instances similar to this one (same rule or overlapping labels such as job, service, cluster, or namespace). Use alerting tools with the rule UID and instance labels from context. For each match, list the rule name, key labels, state, and when it started firing. If multiple instances share a root cause, add a brief 1–2 sentence synthesis at the top. Do not invent details not present in the data.'
      ),
      context: assistantContext,
    },
    {
      title: t('alerting.triage.explain.prompt-affected-systems-title', 'Show me the affected systems'),
      prompt: t(
        'alerting.triage.explain.prompt-affected-systems',
        'Using the attached alert instance context, identify the systems, services, or infrastructure components affected by this alert. Run the rule queries if needed. Summarize as a bullet list. Include label keys like job, service, namespace, cluster, and instance when present. If the scope is unclear, say what you can and cannot determine from the available data.'
      ),
      context: assistantContext,
    },
  ];

  if (includeIncidentHistoryPrompt) {
    questions.push({
      title: t('alerting.triage.explain.prompt-irm-history-title', 'Show me incident/IRM history'),
      prompt: hasLinkedIncidentHistory
        ? t(
            'alerting.triage.explain.prompt-irm-history-with-data',
            'Using the incident history attached to this alert instance context, summarize how past firings of this rule were handled in IRM. Include declared incidents, responders, timeline, and resolution notes where available. If details are incomplete, say what is missing.'
          )
        : t(
            'alerting.triage.explain.prompt-irm-history-no-data',
            'Check whether this alert rule has linked IRM incident history using the attached context, rule annotations, and metadata. If incident metadata is available, summarize how past firings were handled (declared incidents, responders, resolution notes). If not available, say clearly that incident context is not yet linked to this rule and suggest checking IRM directly or declaring an incident from the alert instance.'
          ),
      context: assistantContext,
    });
  }

  return questions;
}
