import { getPanelDataSummary, PanelData } from '@grafana/data';
import { Dashboard, Panel } from '@grafana/schema';

import { getFilteredPanelString } from './utils';

const TITLE_SOFT_LIMIT = 80;
const DESCRIPTION_CHAR_LIMIT = 200;

const ASSISTANT_OUTPUT_INSTRUCTION = [
  "Only return what you're asked for, no reasoning, no explanation whatsoever just the bits that are explicitly requested.",
  'Never ask questions or request clarification. Always produce a result based on the provided context.',
  'If the user message is empty, generate based on the panel context alone.',
].join('\n');

/**
 * Extract sample labels from PanelData for richer context.
 * Collects unique label key-value pairs across fields (capped for prompt size).
 */
function getSampleLabels(data: PanelData): string[] {
  const labelEntries = new Set<string>();

  for (const frame of data.series ?? []) {
    for (const field of frame.fields) {
      const labels = field.labels;
      if (labels && typeof labels === 'object') {
        for (const [key, value] of Object.entries(labels)) {
          if (key && value && labelEntries.size < 30) {
            labelEntries.add(`${key}="${value}"`);
          }
        }
      }
    }
  }

  return [...labelEntries];
}

/**
 * Build data context when PanelData is available (queries have run).
 * Includes metric names, sample labels, field names, and row counts.
 */
function buildDataContext(data?: PanelData): string {
  if (!data?.series?.length) {
    return '';
  }

  const summary = getPanelDataSummary(data.series);
  const parts: string[] = [];

  if (summary.hasData) {
    parts.push(`Data: ${summary.frameCount} frame(s), ${summary.rowCountTotal} total rows`);
  }

  const fieldNames = data.series.flatMap((f) => f.fields.map((field) => field.name));
  const uniqueFieldNames = [...new Set(fieldNames)].filter((n) => n && n !== 'Time' && n !== 'time');
  if (uniqueFieldNames.length > 0) {
    parts.push(`Field names: ${uniqueFieldNames.slice(0, 20).join(', ')}${uniqueFieldNames.length > 20 ? '...' : ''}`);
  }

  const sampleLabels = getSampleLabels(data);
  if (sampleLabels.length > 0) {
    parts.push(`Sample labels: ${sampleLabels.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Build full context string with the panel JSON and live data summary.
 */
function buildFullContext(panel: Panel, dashboard: Dashboard, data?: PanelData): string {
  const parts: string[] = [];

  if (dashboard.title != null && dashboard.title !== '') {
    parts.push(`Dashboard title: ${dashboard.title}`);
  }
  if (dashboard.description != null && dashboard.description !== '') {
    parts.push(`Dashboard description: ${dashboard.description}`);
  }

  parts.push(`Panel definition:\n${getFilteredPanelString(panel)}`);

  const dataContext = buildDataContext(data);
  if (dataContext) {
    parts.push(dataContext);
  }

  return parts.join('\n\n');
}

export interface AssistantPromptResult {
  systemPrompt: string;
  prompt: string;
}

/**
 * Build Assistant prompt for panel title generation.
 */
export function buildAssistantTitlePrompt(panel: Panel, dashboard: Dashboard, data?: PanelData): AssistantPromptResult {
  const systemPrompt = [
    'You are an expert in creating Grafana panel titles.',
    'Generate a human-readable, "speaking" title that describes what the panel shows. Use plain language that a viewer would understand.',
    'Do not simply concatenate or re-assemble metric names. Instead, convey the meaning or purpose of the data (e.g. "Request rate over time", "CPU usage by instance").',
    `Keep it concise (around ${TITLE_SOFT_LIMIT} characters), but prioritize clarity over brevity.`,
    ASSISTANT_OUTPUT_INSTRUCTION,
  ].join('\n');

  return {
    systemPrompt,
    prompt: buildFullContext(panel, dashboard, data),
  };
}

/**
 * Build Assistant prompt for panel description generation.
 */
export function buildAssistantDescriptionPrompt(
  panel: Panel,
  dashboard: Dashboard,
  data?: PanelData
): AssistantPromptResult {
  const systemPrompt = [
    'You are an expert in creating Grafana panel descriptions.',
    'Write a descriptive panel description that explains the purpose of the panel, not just its attributes.',
    'Do not refer to the panel; simply describe its purpose.',
    'No numbers except for thresholds.',
    `Max ${DESCRIPTION_CHAR_LIMIT} characters.`,
    ASSISTANT_OUTPUT_INSTRUCTION,
  ].join('\n');

  return {
    systemPrompt,
    prompt: buildFullContext(panel, dashboard, data),
  };
}

/**
 * @deprecated Use buildAssistantTitlePrompt().systemPrompt
 */
export function buildTitleInputSystemPrompt(panel: Panel, dashboard: Dashboard, data?: PanelData): string {
  return buildAssistantTitlePrompt(panel, dashboard, data).systemPrompt;
}

/**
 * @deprecated Use buildAssistantDescriptionPrompt().systemPrompt
 */
export function buildDescriptionInputSystemPrompt(panel: Panel, dashboard: Dashboard, data?: PanelData): string {
  return buildAssistantDescriptionPrompt(panel, dashboard, data).systemPrompt;
}
