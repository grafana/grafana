import { type WizardDatasource, type WizardFinding } from './types';

/** Origin reported to the assistant for all wizard interactions. */
export const WIZARD_ORIGIN = 'grafana/dashboard-wizard';

const JSON_ONLY_RULE = 'Respond with ONLY the JSON object — no markdown fences, no commentary, no explanation.';

const GROUNDING_RULE =
  'Ground everything in data that actually exists in this Grafana instance. The user message lists the ' +
  'available datasources. Use the list_label_values tool to verify what exists — for Prometheus-compatible ' +
  'datasources, label "job" or "namespace" reveals services and namespaces, and label "__name__" lists metric ' +
  'names (pass "contains" to search). Do not invent services, metrics, or infrastructure you have not verified ' +
  'or that is not strongly implied by the datasource types.';

/**
 * The "Just show me what Grafana can do" intent. Skips refinement entirely:
 * the point is to let the build agent stretch its legs on whatever data the
 * instance has, and to showcase the dashboard features (tabs, rows, auto
 * grid, varied visualizations) in one impressive result.
 */
export const SHOWCASE_INTENT = `Build a showcase dashboard that demonstrates what the Grafana Assistant can do with the data in this Grafana instance. It has two jobs: be a genuinely useful overview of the most important data here, and show off Grafana's dashboarding features.

- Survey the available datasources and build around the richest, most interesting data you find (services, infrastructure, logs — whatever the instance actually has). Tell one coherent story about that data; do not scatter unrelated panels.
- Showcase the layout system: organize the dashboard into tabs (one per domain, e.g. Overview, Traffic, Resources, Logs), group related panels inside tabs into rows where it helps, and use auto grid so sections arrange themselves. Aim for 3-4 tabs and 12-20 panels.
- Showcase visual variety: an at-a-glance section of big-number stats and gauges up front, then time series, bar charts, tables, and a logs panel where the data supports them. Use thresholds and units so the panels look polished.
- Showcase interactivity: template variables that scope the dashboard (datasource, namespace, instance — chained where the data supports it), reused in queries and legends.`;

function formatDatasources(datasources: WizardDatasource[]): string {
  const maxListed = 50;
  const lines = datasources
    .slice(0, maxListed)
    .map((ds) => `- ${ds.name ?? ds.uid} (type: ${ds.type}, uid: ${ds.uid})`);
  if (datasources.length > maxListed) {
    lines.push(`- …and ${datasources.length - maxListed} more`);
  }
  return lines.length > 0 ? lines.join('\n') : '(no datasources available)';
}

/**
 * Prompt for the single wizard-side assistant call: reorganize the user's
 * free-form request into a precise build request, verify the data it refers
 * to, and decide whether clarifying questions are genuinely needed.
 */
export function buildRefinementPrompt(
  request: string,
  datasources: WizardDatasource[],
  contextNotes?: string
): { systemPrompt: string; prompt: string } {
  const systemPrompt = `You prepare build requests for Grafana's "Generate dashboard" wizard. The user described the dashboard they want in their own words; reorganize that into a precise request a dashboard-building agent can execute.

${GROUNDING_RULE} Make at most 3 tool calls.

${JSON_ONLY_RULE}
{
  "prompt": string,
  "dataNotes": string,
  "questions": [{ "id": string, "text": string, "options": [string], "allowMultiple": boolean }]
}

Rules:
- "prompt": the user's request reorganized for the building agent: what to monitor, which datasources/metrics/labels to use (name what you verified), and what sections the dashboard needs. 2-6 sentences, written in English as direct instructions to the builder ("Monitor…", "Use…") — never a narration of what the user said. Preserve every specific the user gave (services, environments, metric names, thresholds, time ranges); resolve vague wording against the real data. Do not add requirements the user never stated.
- "dataNotes": the exact datasource uids, metric names, and label/value pairs you verified exist and the dashboard should be built from (comma-separated). Only include what you actually verified with tools — never list something here on faith. Empty string if you verified nothing.
- "questions": 0-3 clarifying questions, ONLY when the answer genuinely changes the dashboard (e.g. which environment, cluster, namespace, or service to focus on; fleet-wide vs single-instance). Each question has a short slug "id" and 2-5 short answer options — real values you verified beat generic placeholders. No free-text questions, no questions about layout/visualization taste, and never ask about something the request or attached context already answers. If the request is already specific enough to build a good dashboard, return [].

Example (user wrote "I want to see how my checkout service is doing", you verified job="checkout" exists in the Prometheus datasource with RED-style http metrics):
{"prompt":"Monitor the checkout service using the Prometheus datasource (uid: prom-1), scoped to job=\\"checkout\\". Cover request rate, error ratio, and latency percentiles from the http_request_duration_seconds histogram, plus resource usage if available. Sections: an overview of KPIs, then traffic, errors, and latency detail.","dataNotes":"datasource prom-1 (prometheus), job=checkout, http_requests_total, http_request_duration_seconds_bucket","questions":[{"id":"env","text":"Which environment should the dashboard focus on?","options":["production","staging","All environments"],"allowMultiple":false}]}${
    contextNotes
      ? '\n- The user attached specific context items (below). Treat them as the definitive subject of the dashboard: build the request around them, never ask questions their presence already answers.'
      : ''
  }`;

  const contextBlock = contextNotes ? `\n\nContext the user attached:\n${contextNotes}` : '';
  const prompt = `The user's request:\n${request}${contextBlock}\n\nAvailable datasources:\n${formatDatasources(datasources)}`;

  return { systemPrompt, prompt };
}

/** Caps keeping the discovery replay useful without blowing up the prompt. */
const MAX_PROMPT_FINDINGS = 12;
const MAX_PROMPT_VALUES = 50;

function formatFindings(findings: WizardFinding[]): string {
  const lines: string[] = [];
  for (const finding of findings) {
    if (finding.values.length === 0) {
      continue;
    }
    const shown = finding.values.slice(0, MAX_PROMPT_VALUES);
    const filter = finding.contains ? ` matching "${finding.contains}"` : '';
    const more = finding.truncated || finding.values.length > shown.length ? ', …and more' : '';
    lines.push(
      `- ${finding.datasourceName} (type: ${finding.datasourceType}, uid: ${finding.datasourceUid}) — ` +
        `values of "${finding.label}"${filter}: ${shown.join(', ')}${more}`
    );
    if (lines.length >= MAX_PROMPT_FINDINGS) {
      break;
    }
  }
  return lines.join('\n');
}

export function buildGenerationPrompt(args: {
  intent: string;
  clarifications: Array<{ question: string; answer: string }>;
  datasources: WizardDatasource[];
  dataNotes?: string;
  findings?: WizardFinding[];
  /** Serialized context items the user attached through the context picker. */
  contextNotes?: string;
}): string {
  const parts: string[] = ['Build a complete, production-quality dashboard.', `What to build:\n${args.intent}`];

  if (args.clarifications.length > 0) {
    const answers = args.clarifications.map((c) => `- ${c.question}: ${c.answer}`).join('\n');
    parts.push(`Clarifications from me:\n${answers}`);
  }

  if (args.contextNotes) {
    parts.push(
      `Context I attached (the definitive subject of this dashboard — build around these exact items):\n${args.contextNotes}`
    );
  }

  const hasVerifiedData = Boolean(args.dataNotes) || Boolean(args.findings && args.findings.length > 0);
  parts.push(
    hasVerifiedData
      ? `The available datasources (query them by these exact uids — no others exist):\n${formatDatasources(args.datasources)}`
      : `Data to use: find the most relevant data yourself. The available datasources (query them by these exact uids — no others exist):\n${formatDatasources(args.datasources)}`
  );

  if (args.dataNotes) {
    parts.push(
      `Already-verified data (confirmed to exist in this instance — build from it directly, do not re-verify):\n${args.dataNotes}`
    );
  }

  const formattedFindings = args.findings && args.findings.length > 0 ? formatFindings(args.findings) : '';
  if (formattedFindings !== '') {
    parts.push(
      `Label values already looked up while preparing this request (verified against the datasource APIs — reuse them instead of re-querying):\n${formattedFindings}`
    );
  }

  parts.push(
    `Requirements:
- Every panel must show real data. The verified data above is ground truth: build from it directly and do NOT re-check any of it. Run discovery only for data this request does not already list, in one batched round up front — never one check per panel.
- Structure the dashboard into sections — never one flat grid of panels. An overview row of KPI stats first, then detail sections grouped by domain (e.g. traffic, errors, latency, resources); use tabs when the domains are distinct, and auto grid inside every section so panels arrange themselves. Aim for roughly 8-16 panels across 3-5 sections — deep enough to be genuinely useful, without filler panels.
- Add template variables (datasource, cluster, namespace, instance) where the data supports them; chain dependent variables (e.g. namespace filtered by cluster) and reuse them in queries and legends. Every $variable a query references must be defined on the dashboard.
- Polish every panel: proper units (percent, bytes, seconds, reqps), meaningful thresholds on KPI stats/gauges (green baseline, warning ~70-80%, critical ~90%), legend labels from labels ({{pod}}, {{instance}}), and a terse description on non-trivial panels.
- If this Grafana instance already has dashboards on this topic, reuse their proven queries instead of inventing new ones.
- Set a clear dashboard title, a short description, and a time range that matches the data's cadence (now-1h/now-6h for high-frequency metrics; longer if the data is sparse) so nothing is empty on first load.
- Do NOT save the dashboard. I will review it in the editor and save it myself.`
  );

  return parts.join('\n\n');
}

/**
 * Prompt for "improve this dashboard": the headless agent runs against the
 * dashboard already open in the editor (it reads the current state itself),
 * applying the user's requested improvements without rebuilding from scratch.
 */
export function buildImprovementPrompt(args: {
  request: string;
  dashboardTitle?: string;
  datasources: WizardDatasource[];
  contextNotes?: string;
}): string {
  const parts: string[] = [
    `Improve the dashboard currently open in the editor${args.dashboardTitle ? ` ("${args.dashboardTitle}")` : ''}.`,
    `What to improve:\n${args.request}`,
  ];

  if (args.contextNotes) {
    parts.push(`Context I attached (use these exact items where relevant):\n${args.contextNotes}`);
  }

  parts.push(`The available datasources are:\n${formatDatasources(args.datasources)}`);

  parts.push(
    `Requirements:
- Read the dashboard first, then change only what the request calls for — preserve the rest of the structure, panels, and variables.
- If the request is broad ("improve it", "make it better"), do the highest-impact fixes in this order: repair empty or broken panels, group a flat grid into sections, add missing units/thresholds/legend labels, add template variables the data supports. Do not rebuild what already works.
- Every panel you add or change must show real data: verify metrics and labels exist before using them.
- Keep the dashboard polished: proper units, thresholds on KPI panels, legend labels, and terse descriptions on non-trivial panels.
- Do NOT save the dashboard. I will review the changes in the editor and save them myself.`
  );

  return parts.join('\n\n');
}
