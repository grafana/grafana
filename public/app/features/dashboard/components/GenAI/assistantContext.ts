import { getPanelDataSummary, PanelData } from '@grafana/data';
import { Dashboard, Panel } from '@grafana/schema';

const TITLE_SOFT_LIMIT = 80; // Soft limit; prefer concise but allow natural phrasing
const DESCRIPTION_CHAR_LIMIT = 200;

const ASSISTANT_OUTPUT_INSTRUCTION =
  "Only return what you're asked for, no reasoning, no explanation whatsoever just the bits that are explicitly requested.";

/**
 * Extract query-related content from panel targets for context.
 * Returns an array of strings: full query expressions plus any metric/target fields.
 * Targets vary by datasource: Prometheus/Loki use `expr`, Graphite uses `target`, OpenTSDB uses `metric`, etc.
 */
function getQueryContextFromTargets(panel: Panel): string[] {
  const targets = panel.targets ?? [];
  const items: string[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    if (target && typeof target === 'object') {
      // expr (Prometheus, Loki)
      const expr = 'expr' in target ? target.expr : undefined;
      if (typeof expr === 'string' && expr.trim() && !seen.has(expr)) {
        seen.add(expr);
        items.push(expr);
      }
      // query (generic, Elasticsearch, etc.)
      const query = 'query' in target ? target.query : undefined;
      if (typeof query === 'string' && query.trim() && !seen.has(query)) {
        seen.add(query);
        items.push(query);
      }
      // target (Graphite)
      const targetStr = 'target' in target ? target.target : undefined;
      if (typeof targetStr === 'string' && targetStr.trim() && !seen.has(targetStr)) {
        seen.add(targetStr);
        items.push(targetStr);
      }
      // metric (OpenTSDB, CloudWatch)
      const metric = 'metric' in target ? target.metric : undefined;
      if (typeof metric === 'string' && metric.trim() && !seen.has(metric)) {
        seen.add(metric);
        items.push(`metric: ${metric}`);
      }
    }
  }

  return items;
}

/**
 * Extract metric names from panel data.
 * Prometheus fields often have labels.__name__ or the field name is the metric.
 */
function getMetricNamesFromData(data: PanelData): string[] {
  const names = new Set<string>();

  for (const frame of data.series ?? []) {
    for (const field of frame.fields) {
      // Prometheus: __name__ in labels is the metric name
      const labels = field.labels;
      if (labels && typeof labels === 'object' && '__name__' in labels) {
        const nameValue = Object.getOwnPropertyDescriptor(labels, '__name__')?.value;
        if (typeof nameValue === 'string' && nameValue.trim()) {
          names.add(nameValue);
        }
      }
      // Field name often is the metric (e.g. from Prometheus, or Value for single-stat)
      if (field.name && field.name !== 'Time' && field.name !== 'time') {
        names.add(field.name);
      }
    }
  }

  return [...names];
}

/**
 * Build data context when PanelData is available (queries have run).
 * Includes metric names, field names, and row counts for richer context.
 */
function buildDataContext(data?: PanelData): string {
  if (!data?.series?.length) {
    return '';
  }

  const summary = getPanelDataSummary(data.series);
  const parts: string[] = [];

  const metricNames = getMetricNamesFromData(data);
  if (metricNames.length > 0) {
    parts.push(`Metrics being visualized: ${metricNames.slice(0, 15).join(', ')}${metricNames.length > 15 ? '...' : ''}`);
  }

  if (summary.hasData) {
    parts.push(`Data: ${summary.frameCount} frame(s), ${summary.rowCountTotal} total rows`);
  }

  const fieldNames = data.series.flatMap((f) => f.fields.map((field) => field.name));
  const uniqueFieldNames = [...new Set(fieldNames)].filter(
    (n) => n && n !== 'Time' && n !== 'time'
  );
  if (uniqueFieldNames.length > 0) {
    parts.push(`Field names: ${uniqueFieldNames.slice(0, 20).join(', ')}${uniqueFieldNames.length > 20 ? '...' : ''}`);
  }

  return parts.length > 0 ? parts.join('. ') : '';
}

/**
 * Build panel context for Assistant - visualization type, datasource, queries, and data when available.
 */
function buildPanelContext(panel: Panel, data?: PanelData): string {
  const parts: string[] = [];

  if (panel.type) {
    parts.push(`Visualization type: ${panel.type}`);
  }

  const dsRef = panel.datasource;
  if (dsRef && typeof dsRef === 'object' && 'type' in dsRef) {
    const typeProp = Object.getOwnPropertyDescriptor(dsRef, 'type')?.value;
    if (typeof typeProp === 'string') {
      parts.push(`Datasource: ${typeProp}`);
    }
  }

  const queryContext = getQueryContextFromTargets(panel);
  if (queryContext.length > 0) {
    parts.push(`Queries and metrics being queried:\n${queryContext.map((e) => `- ${e}`).join('\n')}`);
  }

  const dataContext = buildDataContext(data);
  if (dataContext) {
    parts.push(dataContext);
  }

  return parts.join('\n');
}

/**
 * Build dashboard context - only include when defined.
 */
function buildDashboardContext(dashboard: Dashboard): string {
  const parts: string[] = [];

  if (dashboard.title != null && dashboard.title !== '') {
    parts.push(`Dashboard title: ${dashboard.title}`);
  }

  if (dashboard.description != null && dashboard.description !== '') {
    parts.push(`Dashboard description: ${dashboard.description}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

export interface AssistantPromptResult {
  systemPrompt: string;
  prompt: string;
}

/**
 * Build Assistant prompt for panel title generation.
 */
export function buildAssistantTitlePrompt(
  panel: Panel,
  dashboard: Dashboard,
  data?: PanelData
): AssistantPromptResult {
  const systemPrompt = [
    'You are an expert in creating Grafana panel titles.',
    'Generate a human-readable, "speaking" title that describes what the panel shows. Use plain language that a viewer would understand.',
    'Do not simply concatenate or re-assemble metric names. Instead, convey the meaning or purpose of the data (e.g. "Request rate over time", "CPU usage by instance").',
    `Keep it concise (around ${TITLE_SOFT_LIMIT} characters), but prioritize clarity over brevity.`,
    ASSISTANT_OUTPUT_INSTRUCTION,
  ].join('\n');

  const dashboardContext = buildDashboardContext(dashboard);
  const panelContext = buildPanelContext(panel, data);

  const promptParts: string[] = [];
  if (dashboardContext) {
    promptParts.push(dashboardContext);
  }
  promptParts.push(panelContext);

  return {
    systemPrompt,
    prompt: promptParts.join('\n\n'),
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

  const dashboardContext = buildDashboardContext(dashboard);
  const panelContext = buildPanelContext(panel, data);

  const promptParts: string[] = [];
  if (dashboardContext) {
    promptParts.push(dashboardContext);
  }
  promptParts.push(panelContext);

  return {
    systemPrompt,
    prompt: promptParts.join('\n\n'),
  };
}
