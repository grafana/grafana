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
        `Using the attached alert instance context, start by fetching this rule with alerting_manage_rules (rule UID is in context). Then find up to 10 currently firing or pending alert instances similar to this one — same rule, or overlapping labels such as job, service, namespace, cluster, or instance.

List each match with: rule name, key labels, state, and when it started firing. Note how many instances are firing on this rule and which label dimensions differ between instances. If several share a likely root cause, add a brief 1–2 sentence synthesis at the top only — do not invent details not present in the data.`
      ),
      context: assistantContext,
    },
    {
      title: t('alerting.triage.explain.prompt-affected-systems-title', 'Show me the affected systems'),
      prompt: t(
        'alerting.triage.explain.prompt-affected-systems',
        `Using the attached alert instance context, identify the systems, services, and infrastructure components affected by this firing alert.

1. Fetch the full rule with alerting_manage_rules (expression, labels, annotations).
2. Run the alert expression to confirm label dimensions present in the result (e.g. instance, job, namespace, pod, env). Only use labels confirmed here — never guess label names.
3. Use firing labels to find blast radius: describe_infrastructure for service groups and dependencies, search_in_graph for related services or databases, and get_entity_health for anomalies where available.

Summarize affected systems as a bullet list with concrete dependency context. If scope is unclear, say what you can and cannot determine from the available data.`
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
            `Using the incident history attached to this alert instance context, summarize how past firings of this rule were handled in IRM. Include declared incidents, responders, timeline, and resolution notes where available. Relate findings to the current firing instance labels where possible. If details are incomplete, say what is missing.`
          )
        : t(
            'alerting.triage.explain.prompt-irm-history-no-data',
            `Check whether this alert rule has linked IRM incident history using the attached context, rule annotations, and metadata. If incident metadata is available, summarize how past firings were handled (declared incidents, responders, resolution notes). If not available, say clearly that incident context is not yet linked to this rule and suggest checking IRM directly or declaring an incident from this alert instance.`
          ),
      context: assistantContext,
    });
  }

  return questions;
}
