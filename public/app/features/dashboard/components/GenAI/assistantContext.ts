import { Dashboard, Panel } from '@grafana/schema';

const TITLE_SOFT_LIMIT = 80;
const DESCRIPTION_CHAR_LIMIT = 200;

const ASSISTANT_OUTPUT_INSTRUCTION = [
  "Only return what you're asked for, no reasoning, no explanation whatsoever just the bits that are explicitly requested.",
  'Never ask questions or request clarification. Always produce a result based on the provided context.',
  'If the user message is empty, generate based on the panel context alone.',
].join('\n');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const TITLE_SYSTEM_PROMPT = [
  'You are an expert in creating Grafana panel titles.',
  'Generate a human-readable, "speaking" title that describes what the panel shows. Use plain language that a viewer would understand.',
  'Do not simply concatenate or re-assemble metric names. Instead, convey the meaning or purpose of the data (e.g. "Request rate over time", "CPU usage by instance").',
  `Keep it concise (around ${TITLE_SOFT_LIMIT} characters), but prioritize clarity over brevity.`,
  ASSISTANT_OUTPUT_INSTRUCTION,
].join('\n');

export const DESCRIPTION_SYSTEM_PROMPT = [
  'You are an expert in creating Grafana panel descriptions.',
  'Write a descriptive panel description that explains the purpose of the panel, not just its attributes.',
  'Do not refer to the panel; simply describe its purpose.',
  'No numbers except for thresholds.',
  `Max ${DESCRIPTION_CHAR_LIMIT} characters.`,
  ASSISTANT_OUTPUT_INSTRUCTION,
].join('\n');

/**
 * Extract query expressions from panel targets.
 * Datasources store queries in different fields: expr (Prometheus/Loki), query (Elasticsearch), target (Graphite), metric (CloudWatch/OpenTSDB).
 */
function getQueryExpressions(panel: Panel): string[] {
  const targets = panel.targets ?? [];
  const items: string[] = [];
  const seen = new Set<string>();

  for (const t of targets) {
    if (!isRecord(t)) {
      continue;
    }
    for (const key of ['expr', 'query', 'target', 'metric']) {
      const val = t[key];
      if (typeof val === 'string' && val.trim() && !seen.has(val)) {
        seen.add(val);
        items.push(val);
      }
    }
  }
  return items;
}

function hasDatasourceIdentity(panel: Panel): boolean {
  const ds = panel.datasource;

  if (typeof ds === 'string') {
    return ds.trim().length > 0;
  }

  if (!ds || typeof ds !== 'object') {
    return false;
  }

  const { uid, name } = ds;
  return (typeof uid === 'string' && uid.trim().length > 0) || (typeof name === 'string' && name.trim().length > 0);
}

function hasTextPanelContent(panel: Panel): boolean {
  if (panel.type !== 'text') {
    return false;
  }

  const content = isRecord(panel.options) ? panel.options.content : undefined;
  return typeof content === 'string' && content.trim().length > 0;
}

export function hasMeaningfulPanelContext(panel: Panel): boolean {
  return hasDatasourceIdentity(panel) || getQueryExpressions(panel).length > 0 || hasTextPanelContent(panel);
}

export function buildPanelContext(panel: Panel, dashboard: Dashboard): string {
  const ctx: Record<string, unknown> = {};

  if (dashboard.title) {
    ctx.dashboardTitle = dashboard.title;
  }
  if (dashboard.description) {
    ctx.dashboardDescription = dashboard.description;
  }
  if (panel.type) {
    ctx.visualization = panel.type;
  }

  const ds = panel.datasource;
  if (isRecord(ds)) {
    const datasourceCtx: Record<string, string> = {};

    if (typeof ds.type === 'string' && ds.type) {
      datasourceCtx.type = ds.type;
    }
    if (typeof ds.uid === 'string' && ds.uid) {
      datasourceCtx.uid = ds.uid;
    }
    if (typeof ds.name === 'string' && ds.name) {
      datasourceCtx.name = ds.name;
    }

    if (Object.keys(datasourceCtx).length > 0) {
      ctx.datasource = datasourceCtx;
    }
  } else if (typeof ds === 'string' && ds.trim()) {
    ctx.datasource = ds;
  }

  const queries = getQueryExpressions(panel);
  if (queries.length > 0) {
    ctx.queries = queries;
  }

  return JSON.stringify(ctx, null, 2);
}
