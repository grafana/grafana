import { t } from '@grafana/i18n';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { sendInsightPrompt } from './askAssistant';
import { getInsightPanelOptions, getInsightPanels } from './insightPanels';
import { getInsightsDashboard, readInsightQuestions } from './insightsStorage';
import { SUGGESTION_SYSTEM_PROMPT } from './prompt';
import { getPanelLocation } from './sections';
import { type InsightSourcePanel } from './sources';

const MAX_SUGGESTIONS = 4;
const MAX_SUGGESTION_LENGTH = 200;

export interface InsightSuggestion {
  question: string;
  sourcePanelKeys: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getExistingQuestions(dashboard: DashboardSceneLike): string[] {
  const fromPanels = getInsightPanels(dashboard).map((panel) => getInsightPanelOptions(panel).question);
  const saved = 'serializer' in dashboard ? readInsightQuestions(getInsightsDashboard(dashboard)).questions : [];
  return [...fromPanels, ...saved.map((question) => question.question)].filter(Boolean);
}

/** Model output is untrusted: keep only questions whose sources are panels the author can select. */
function parseSuggestions(text: string, sources: InsightSourcePanel[]): InsightSuggestion[] {
  let value: unknown;
  try {
    value = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    value = undefined;
  }
  const keys = new Set(sources.map((source) => source.key));
  const suggestions: InsightSuggestion[] = [];
  const items = isRecord(value) && Array.isArray(value.suggestions) ? value.suggestions : [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.question !== 'string' || !Array.isArray(item.sourcePanelKeys)) {
      continue;
    }
    const question = item.question.trim();
    const sourcePanelKeys = [
      ...new Set(item.sourcePanelKeys.filter((key): key is string => typeof key === 'string' && keys.has(key))),
    ];
    if (question && question.length <= MAX_SUGGESTION_LENGTH && sourcePanelKeys.length) {
      suggestions.push({ question, sourcePanelKeys });
    }
  }
  if (!suggestions.length) {
    throw new Error(
      t('dashboard.insights.suggestions.none', 'Assistant did not suggest any questions these panels can answer.')
    );
  }
  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/** Sends only panel titles, descriptions, and types — no data — and suggests questions the panels could answer. */
export async function suggestInsightQuestions(
  dashboard: DashboardSceneLike,
  sources: InsightSourcePanel[],
  signal: AbortSignal
): Promise<InsightSuggestion[]> {
  const input = {
    dashboard: { title: dashboard.state.title, description: dashboard.state.description ?? '' },
    panels: sources.map((source) => ({
      key: source.key,
      title: source.title,
      description: source.description,
      section: getPanelLocation(source) || undefined,
      type: source.panel.state.pluginId,
    })),
    existingQuestions: getExistingQuestions(dashboard),
  };
  return parseSuggestions(await sendInsightPrompt(input, SUGGESTION_SYSTEM_PROMPT, signal), sources);
}
