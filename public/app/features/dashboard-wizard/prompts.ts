import { type WizardDatasource, type WizardFinding, type WizardSummary, type WizardVerifiedMetric } from './types';

/** Origin reported to the assistant for all wizard interactions. */
export const WIZARD_ORIGIN = 'grafana/dashboard-wizard';

/** The user reviewed a previously proposed plan and asked for changes on the review step. */
export interface WizardRevision {
  /** The build prompt from the plan being revised. */
  previousPrompt: string;
  /** The plain-language plan the user is reacting to, if one was produced. */
  previousSummary?: WizardSummary;
  /** What the user wants changed, in their own words. */
  feedback: string;
}

/** Renders a previously proposed plan back into text for the revision prompt. */
function formatSummaryForPrompt(summary: WizardSummary): string {
  const lines = [`Title: ${summary.title}`, `Description: ${summary.description}`];
  if (summary.layout) {
    lines.push(`Layout: ${summary.layout}`);
  }
  for (const section of summary.sections) {
    lines.push(`Section "${section.title}":`);
    for (const panel of section.panels) {
      lines.push(`  - ${panel.title}${panel.visualization ? ` (${panel.visualization})` : ''}`);
    }
  }
  return lines.join('\n');
}

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
  contextNotes?: string,
  revision?: WizardRevision,
  /** Metrics from a previous attempt that were checked and do not exist — must not be reused. */
  unavailableMetrics?: string[]
): { systemPrompt: string; prompt: string } {
  const systemPrompt = `You prepare build requests for Grafana's "Generate dashboard" wizard. The user described the dashboard they want in their own words; reorganize that into a precise request a dashboard-building agent can execute.

${GROUNDING_RULE} Verify that every metric you put in the plan actually exists using list_label_values on "__name__" (use the "contains" argument to search for candidates) before including it — never plan a panel around a metric you have not confirmed exists. Make up to 8 tool calls; batch related lookups.

${JSON_ONLY_RULE}
{
  "prompt": string,
  "summary": {
    "title": string,
    "description": string,
    "layout": string,
    "sections": [{ "title": string, "panels": [{ "title": string, "visualization": string }] }]
  },
  "dataNotes": string,
  "metrics": [{ "datasourceUid": string, "names": [string] }],
  "questions": [{ "id": string, "text": string, "options": [string], "allowMultiple": boolean }]
}

Rules:
- "prompt": the user's request reorganized for the building agent: what to monitor, which datasources/metrics/labels to use (name what you verified), and what sections the dashboard needs. 2-6 sentences, written in English as direct instructions to the builder ("Monitor…", "Use…") — never a narration of what the user said. Preserve every specific the user gave (services, environments, metric names, thresholds, time ranges); resolve vague wording against the real data. Do not add requirements the user never stated.
- "summary": a plain-language preview of the dashboard laid out panel by panel, shown to the user to review before building. It must describe the SAME dashboard as "prompt".
  - "title": a concise dashboard title (max ~6 words).
  - "description": one sentence naming what it monitors.
  - "layout": one sentence on the overall structure — how the sections are organized (e.g. "Four tabs — Overview, Traffic, Errors, and Resources — each auto-arranged.").
  - "sections": 3-6 sections, in the order they appear. Each has a "title" (the tab or row name) and "panels": 2-6 panels, each with a human-readable "title" and a "visualization" naming the panel type in plain language (one of: stat, gauge, bar gauge, time series, bar chart, table, logs, heatmap, pie chart, state timeline). Lead with an at-a-glance section of stats/gauges where it fits, then detail sections.
  Write for the user, not the builder: no datasource uids, no raw metric names, no tool names, no jargon. Keep it consistent with "prompt".
- "dataNotes": the exact datasource uids, metric names, and label/value pairs you verified exist and the dashboard should be built from (comma-separated). Only include what you actually verified with tools — never list something here on faith. Empty string if you verified nothing.
- "metrics": every metric name the planned panels will query, grouped by datasource uid. You MUST have confirmed each one exists via list_label_values on "__name__" — never list a metric on faith; this list is checked against the datasource before the plan is shown. Only list Prometheus-style metric names; omit datasources that have no metric-name concept (e.g. Loki). Empty array if none apply.
- "questions": 0-3 clarifying questions, ONLY when the answer genuinely changes the dashboard (e.g. which environment, cluster, namespace, or service to focus on; fleet-wide vs single-instance). Each question has a short slug "id" and 2-5 short answer options — real values you verified beat generic placeholders. No free-text questions, no questions about layout/visualization taste, and never ask about something the request or attached context already answers. If the request is already specific enough to build a good dashboard, return [].

Example (user wrote "I want to see how my checkout service is doing", you verified job="checkout" exists in the Prometheus datasource with RED-style http metrics):
{"prompt":"Monitor the checkout service using the Prometheus datasource (uid: prom-1), scoped to job=\\"checkout\\". Cover request rate, error ratio, and latency percentiles from the http_request_duration_seconds histogram, plus resource usage if available. Sections: an overview of KPIs, then traffic, errors, and latency detail.","summary":{"title":"Checkout service health","description":"Monitors the reliability and performance of the checkout service using its Prometheus metrics.","layout":"Three tabs — Overview, Traffic & errors, and Latency & resources — each auto-arranged.","sections":[{"title":"Overview","panels":[{"title":"Request rate","visualization":"stat"},{"title":"Error rate","visualization":"stat"},{"title":"p95 latency","visualization":"gauge"}]},{"title":"Traffic & errors","panels":[{"title":"Requests per second by endpoint","visualization":"time series"},{"title":"Error ratio over time","visualization":"time series"},{"title":"Top failing endpoints","visualization":"table"}]},{"title":"Latency & resources","panels":[{"title":"Latency percentiles (p50/p95/p99)","visualization":"time series"},{"title":"CPU and memory usage","visualization":"time series"}]}]},"dataNotes":"datasource prom-1 (prometheus), job=checkout, http_requests_total, http_request_duration_seconds_bucket","metrics":[{"datasourceUid":"prom-1","names":["http_requests_total","http_request_duration_seconds_bucket"]}],"questions":[{"id":"env","text":"Which environment should the dashboard focus on?","options":["production","staging","All environments"],"allowMultiple":false}]}${
    contextNotes
      ? '\n- The user attached specific context items (below). Treat them as the definitive subject of the dashboard: build the request around them, never ask questions their presence already answers.'
      : ''
  }`;

  const contextBlock = contextNotes ? `\n\nContext the user attached:\n${contextNotes}` : '';

  // On the review step the user can ask for changes to the plan you proposed.
  // Apply the feedback to the previous plan rather than starting over, and
  // don't re-open clarifying questions.
  const revisionSystem = revision
    ? '\n\nThe user reviewed the plan you previously proposed and asked for changes. Apply their feedback and return the full updated plan. Keep everything they did not ask to change, and preserve the parts of the previous plan that still hold. Return an empty "questions" array — do not ask for more clarification, just apply the changes.'
    : '';

  const revisionBlock = revision
    ? `\n\nThe plan you previously proposed:\n${
        revision.previousSummary ? formatSummaryForPrompt(revision.previousSummary) : revision.previousPrompt
      }\n\nThe user's requested changes:\n${revision.feedback}`
    : '';

  // A previous attempt referenced metrics that were checked and don't exist.
  // Force a rebuild that only uses metrics confirmed to exist.
  const hasUnavailable = unavailableMetrics !== undefined && unavailableMetrics.length > 0;
  const correctionSystem = hasUnavailable
    ? '\n\nSome metrics in your previous answer were checked against the datasources and DO NOT exist. Do not use them. Re-verify metric names with list_label_values on "__name__" and rebuild the plan and "metrics" using only metrics that exist — swap each unavailable metric for a real one that serves the same purpose, or drop the panel if no real data supports it. Keep the same intent and structure otherwise.'
    : '';
  const correctionBlock = hasUnavailable
    ? `\n\nThese metrics you referenced were checked and DO NOT exist — do not use them again:\n${unavailableMetrics
        .map((name) => `- ${name}`)
        .join('\n')}`
    : '';

  const prompt = `The user's request:\n${request}${contextBlock}${revisionBlock}${correctionBlock}\n\nAvailable datasources:\n${formatDatasources(datasources)}`;

  return { systemPrompt: systemPrompt + revisionSystem + correctionSystem, prompt };
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
  /** The plan the user reviewed and approved on the summary step; the build must match it. */
  summary?: WizardSummary;
  /** Confirmed metrics with the labels each actually carries, so queries only filter by real labels. */
  verifiedMetrics?: WizardVerifiedMetric[];
}): string {
  const plan = args.summary && args.summary.sections.length > 0 ? args.summary : undefined;
  const verifiedMetrics = args.verifiedMetrics ?? [];

  const parts: string[] = ['Build a complete, production-quality dashboard.', `What to build:\n${args.intent}`];

  if (plan) {
    parts.push(
      `The plan I reviewed and approved — build the dashboard to match it exactly. Create these sections in this order, and in each section the panels listed with the stated visualization. Do not drop, merge, reorder, rename beyond light polish, or add sections or panels:\n${formatSummaryForPrompt(
        plan
      )}`
    );
  }

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

  if (verifiedMetrics.length > 0) {
    const lines = verifiedMetrics
      .map((metric) => {
        const labels =
          metric.labels === undefined
            ? 'labels not checked — confirm before filtering'
            : metric.labels.length > 0
              ? `labels: ${metric.labels.join(', ')}`
              : 'no labels beyond __name__';
        return `- ${metric.datasourceUid}: ${metric.name} (${labels})`;
      })
      .join('\n');
    parts.push(
      `Verified metrics — each was checked against the datasource and confirmed to exist, and the labels listed are the ONLY labels that metric carries. Build from these directly, but filter or build template variables for a metric strictly from its own listed labels. A label not listed for a metric does not exist on it, even if it exists elsewhere in the datasource — never apply it:\n${lines}`
    );
  }

  if (args.dataNotes) {
    parts.push(
      `Planning notes (datasources, labels, and values noted while preparing the request — useful context only; the "Verified metrics" block above is authoritative for which labels each metric has. Do not filter a metric by a label from these notes unless that label is listed for the metric above):\n${args.dataNotes}`
    );
  }

  const formattedFindings = args.findings && args.findings.length > 0 ? formatFindings(args.findings) : '';
  if (formattedFindings !== '') {
    parts.push(
      `Label values already looked up while preparing this request (verified against the datasource APIs — reuse them instead of re-querying):\n${formattedFindings}`
    );
  }

  const structureRequirement = plan
    ? '- Follow the approved plan above as the source of truth for structure: the same sections in the same order, each holding the listed panels with the stated visualization. Put each section in its own tab or row and use auto grid inside it so panels arrange themselves. Do not invent extra panels or sections beyond the plan.'
    : '- Structure the dashboard into sections — never one flat grid of panels. An overview row of KPI stats first, then detail sections grouped by domain (e.g. traffic, errors, latency, resources); use tabs when the domains are distinct, and auto grid inside every section so panels arrange themselves. Aim for roughly 8-16 panels across 3-5 sections — deep enough to be genuinely useful, without filler panels.';

  const titleRequirement = plan
    ? `- Use "${plan.title}" as the dashboard title, add a short description, and set a time range that matches the data's cadence (now-1h/now-6h for high-frequency metrics; longer if the data is sparse) so nothing is empty on first load.`
    : `- Set a clear dashboard title, a short description, and a time range that matches the data's cadence (now-1h/now-6h for high-frequency metrics; longer if the data is sparse) so nothing is empty on first load.`;

  parts.push(
    `Requirements:
- Every panel must show real data. Build from the "Verified metrics" above directly. Anything not in that list — including metrics mentioned only in the planning notes or implied by "or variants" wording — must be confirmed with a discovery query before you use it; do a single batched round of discovery up front rather than one check per panel.
- After building, do not trust a panel that returns no data: treat an empty result as a signal that the metric or label filter is wrong, run a discovery query to find the correct one, and fix the panel. Never leave a panel empty or built on a metric you could not confirm.
${structureRequirement}
- Add template variables only for labels that actually exist on the metrics you query (per the Verified metrics block — do not add a cluster or namespace variable if the metrics don't carry those labels). Define each variable's values with a label_values() query scoped to a metric that has that label, so it never resolves to empty. Chain dependent variables only when both labels coexist on the same metrics.
- Create every template variable a query will use BEFORE the panels that reference it, and reuse variables in queries and legends. A query must never reference a $variable that is not defined on the dashboard. As a final step, re-scan every panel's queries: for each $variable used, confirm a matching dashboard variable exists — if one is missing, either add it (with a valid label_values() query) or replace the reference with a concrete value. Do not finish with any query referencing an undefined variable.
- Multi-value template variables must render valid PromQL: use the =~ matcher with the pipe format, e.g. label=~"\${var:pipe}" (renders a|b) — never put a raw \${var} inside {} and never use = with a multi-value variable. Guard against an empty variable matching nothing: if a variable can be empty, don't let its matcher exclude all series.
- Polish every panel: proper units (percent, bytes, seconds, reqps), meaningful thresholds on KPI stats/gauges (green baseline, warning ~70-80%, critical ~90%), legend labels from labels ({{pod}}, {{instance}}), and a terse description on non-trivial panels.
- If this Grafana instance already has dashboards on this topic, reuse their proven queries instead of inventing new ones.
${titleRequirement}
- Do NOT save the dashboard. I will review it in the editor and save it myself.`
  );

  return parts.join('\n\n');
}

/**
 * Prompt for an automatic repair pass: after a build, deterministic validation
 * found problems (e.g. queries referencing undefined template variables). The
 * agent runs against the dashboard already open in the editor and fixes only
 * those problems, without rebuilding.
 */
export function buildRepairPrompt(issues: { undefinedVariables: string[] }): string {
  const parts: string[] = [
    'The dashboard you just built has problems that must be fixed. Work on the dashboard currently open in the editor and fix only what is listed below.',
  ];

  if (issues.undefinedVariables.length > 0) {
    const vars = issues.undefinedVariables.map((name) => `$${name}`).join(', ');
    parts.push(
      `Some queries reference template variables that are NOT defined on the dashboard: ${vars}. For each one, either define the variable (a query variable whose label_values() query is scoped to a metric that actually has that label, so it never resolves to empty) or replace the reference in the query with a concrete value. Then re-scan every query and confirm no query references an undefined variable.`
    );
  }

  parts.push(
    'Change only what is needed to fix these problems — leave everything else as is. Do NOT save the dashboard.'
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
