import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureInlineAssistantInitialized, getInlineAssistantFactory, type InlineAssistant } from '@grafana/assistant';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DatasourceCapabilities, type MetricFamily, type MetricMeta, type MetricType } from './capabilities';
import { composeRecipe } from './composeRecipe';
import {
  type DashboardRecipe,
  type RecipeInnerLayout,
  type RecipePanel,
  type RecipePanelSpan,
  type RecipePanelType,
  type RecipeQuery,
  type RecipeRow,
  type RecipeSection,
  type RecipeSectionKind,
  type RecipeThreshold,
  type RecipeThresholdColor,
  type RecipeVariable,
} from './recipe';
import {
  type CustomizationOptions,
  type DatasourceAnalysis,
  type ExplorationOption,
  type IntentSelection,
} from './types';

/**
 * Cap on how much analysis context we forward to the LLM — enough to guide it
 * without inflating the prompt on chatty datasources.
 */
const MAX_LABEL_KEYS_IN_PROMPT = 25;
const MAX_SAMPLE_VALUES_PER_LABEL = 6;
/** How many intent-relevant metric names we forward. Enough to ground the queries without bloating the prompt. */
const MAX_RELEVANT_METRICS_IN_PROMPT = 60;
/** How many metric families (namespace overview) we forward for breadth. */
const MAX_METRIC_FAMILIES_IN_PROMPT = 24;

/** Hard ceiling on panels we accept from the LLM. Keeps the grid layout scannable. */
const MAX_PANELS = 24;

/**
 * Ceiling on variables. A single-dimension dashboard only needs one, but a
 * multi-selection dashboard legitimately needs one template variable per distinct
 * pivot dimension, so we leave headroom for a handful.
 */
const MAX_VARIABLES = 6;

/** Ceiling on sections in a recipe. Beyond this the modal footprint gets unwieldy. */
const MAX_SECTIONS = 6;
/** Ceiling on panels per section. Bigger sections should be split. */
const MAX_PANELS_PER_SECTION = 8;

/**
 * Ceiling on how many intents we generate concurrently. Each selected intent is
 * handled by its own inline-assistant "agent" (a separate conversation + LLM
 * call), so this also bounds the fan-out we put on the Assistant backend.
 */
const MAX_AGENTS = 8;

/**
 * When several intents are merged into one dashboard, each intent becomes a tab.
 * This caps the panels we keep per tab so a single agent that went overboard
 * doesn't dominate the merged result.
 */
const MAX_PANELS_PER_TAB = 14;

/** Ceiling on rows kept inside a single section/tab. */
const MAX_ROWS_PER_SECTION = 5;

/** Ceiling on panels in a single beautified detail row. */
const MAX_PANELS_PER_ROW = 8;

const ALLOWED_SECTION_KINDS: readonly RecipeSectionKind[] = ['tab', 'row'];
const ALLOWED_INNER_LAYOUTS: readonly RecipeInnerLayout[] = ['grid', 'auto'];

const ALLOWED_PANEL_TYPES: RecipePanelType[] = [
  'timeseries',
  'stat',
  'gauge',
  'bargauge',
  'table',
  'piechart',
  'heatmap',
  'logs',
];

const ALLOWED_LEGENDS = ['hidden', 'list', 'table'] as const;
const ALLOWED_COLORS: RecipeThresholdColor[] = ['green', 'yellow', 'orange', 'red', 'blue', 'purple'];
const ALLOWED_SORTS = ['disabled', 'alphabeticalAsc', 'alphabeticalDesc', 'numericalAsc', 'numericalDesc'] as const;
const ALLOWED_SPANS: RecipePanelSpan[] = [6, 8, 12, 16, 18, 24];

export interface GenerateDashboardRequest {
  /**
   * The intents the user selected, each paired with the dimension it pivots on.
   * Non-empty. The first entry drives telemetry / dashboard title fallback; every
   * entry contributes its own guidance section to the LLM prompt, and — for
   * multi-selection requests — the prompt asks for one tab per selection (each
   * pivoting on its own dimension) so the resulting dashboard structurally
   * reflects the user's picks even when they span different groups.
   */
  selections: IntentSelection[];
  primaryDatasource: DataSourceInstanceSettings;
  additionalDatasources: DataSourceInstanceSettings[];
  analysis: DatasourceAnalysis;
  customization: CustomizationOptions;
}

export interface GeneratedDashboard {
  spec: DashboardV2Spec;
  /** Raw recipe returned by the LLM, useful for debugging / telemetry. */
  recipe: DashboardRecipe;
}

interface UseDashboardGeneratorResult {
  /** Non-null once a spec has been produced. */
  result: GeneratedDashboard | null;
  isLoading: boolean;
  error: Error | null;
  /** Fire a headless generation. Resolves state via `result` / `error`. */
  generate: (request: GenerateDashboardRequest) => void;
  /** Cancel any in-flight generation. */
  cancel: () => void;
  /** Reset back to idle (e.g. after routing away). */
  reset: () => void;
}

/**
 * React hook that generates a Grafana V2 dashboard spec entirely headlessly.
 * There is no Assistant sidebar involvement.
 *
 * Generation is fanned out: every selected intent gets its own inline-assistant
 * "agent" (a separate conversation + LLM call) that produces a focused recipe for
 * that one intent, and the results are merged client-side into a single
 * `DashboardV2Spec`. This has three benefits over the old single-call approach:
 * - No truncation. Each call only has to describe one intent, so it comfortably
 *   fits the model's output-token cap even for rich, multi-panel views.
 * - More complex output. With the whole budget spent on one concern, each agent
 *   can go deep (a full multi-section dashboard for a lone intent, or a dense
 *   12-panel tab when several intents are combined).
 * - Fault isolation. One agent failing or returning junk doesn't sink the others;
 *   we build the dashboard from whatever succeeded.
 *
 * We deliberately do NOT ask the LLM to produce V2 JSON directly (see `recipe.ts`
 * for the rationale). Recipes are small, easy to validate, and make prompt
 * engineering tractable.
 */
export function useDashboardGenerator(): UseDashboardGeneratorResult {
  const [result, setResult] = useState<GeneratedDashboard | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // A monotonic request id lets us discard results from a superseded generation
  // (e.g. the user hit Generate twice, or navigated away).
  const requestIdRef = useRef(0);
  // Assistants currently in flight, so `cancel()` can stop them mid-stream.
  const activeAssistantsRef = useRef<InlineAssistant[]>([]);

  const cancelActive = useCallback(() => {
    for (const assistant of activeAssistantsRef.current) {
      try {
        assistant.cancel();
      } catch {
        // best-effort — a disposed/finished assistant can throw here.
      }
    }
  }, []);

  const generate = useCallback(
    (request: GenerateDashboardRequest) => {
      const requestId = ++requestIdRef.current;
      cancelActive();
      activeAssistantsRef.current = [];
      setResult(null);
      setError(null);
      setIsLoading(true);

      runMultiAgentGeneration(request, {
        register: (assistant) => activeAssistantsRef.current.push(assistant),
        isStale: () => requestIdRef.current !== requestId,
      })
        .then((outcome) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          if (outcome.recipe) {
            try {
              setResult({ spec: composeRecipe(outcome.recipe), recipe: outcome.recipe });
            } catch (err) {
              setError(err instanceof Error ? err : new Error(String(err)));
            }
          } else {
            setError(outcome.error ?? new Error('Dashboard generation produced no panels.'));
          }
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          // Only touch shared state if we're still the active request — a
          // superseded run must not clobber a newer one's loading flag or its
          // registered assistants (which `cancel()` relies on).
          if (requestIdRef.current === requestId) {
            setIsLoading(false);
            activeAssistantsRef.current = [];
          }
        });
    },
    [cancelActive]
  );

  const cancel = useCallback(() => {
    // Invalidate any in-flight response and stop the agents.
    requestIdRef.current++;
    cancelActive();
    activeAssistantsRef.current = [];
    setIsLoading(false);
  }, [cancelActive]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    cancelActive();
    activeAssistantsRef.current = [];
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, [cancelActive]);

  useEffect(() => {
    return () => {
      // Bump the ref counter so any late result is ignored after unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestIdRef.current++;
      cancelActive();
    };
  }, [cancelActive]);

  return { result, isLoading, error, generate, cancel, reset };
}

/** Lifecycle hooks the orchestrator uses to register agents and detect staleness. */
interface MultiAgentHooks {
  /** Called with each assistant as it's created, so the caller can cancel it. */
  register: (assistant: InlineAssistant) => void;
  /** Returns true once this generation has been superseded — stop doing work. */
  isStale: () => boolean;
}

interface MultiAgentOutcome {
  /** The merged recipe, or null when every agent failed. */
  recipe: DashboardRecipe | null;
  /** The first error encountered, surfaced only when nothing succeeded. */
  error: Error | null;
}

/** One agent's parsed contribution. */
interface IntentResult {
  selection: IntentSelection;
  recipe: DashboardRecipe;
}

/**
 * Runs one inline-assistant agent per selected intent (in parallel) and merges
 * the successful ones into a single recipe. A lone intent keeps its full,
 * multi-section shape; several intents each become a tab of the merged dashboard.
 */
async function runMultiAgentGeneration(
  request: GenerateDashboardRequest,
  hooks: MultiAgentHooks
): Promise<MultiAgentOutcome> {
  const selections = request.selections.slice(0, MAX_AGENTS);
  if (selections.length === 0) {
    return { recipe: null, error: new Error('No intent selected.') };
  }

  await ensureInlineAssistantInitialized();
  const factory = getInlineAssistantFactory();
  const mode: JobMode = selections.length > 1 ? 'tab' : 'standalone';

  const created: InlineAssistant[] = [];
  try {
    const jobs = selections.map(async (selection): Promise<IntentResult | { error: Error }> => {
      const assistant = await factory(`grafana/generate-dashboard-wizard/dashboard-generator/${selection.intent.id}`);
      created.push(assistant);
      hooks.register(assistant);
      try {
        const text = await runIntentAgent(assistant, selection, request, mode);
        if (hooks.isStale()) {
          return { error: new Error('superseded') };
        }
        // Parse each agent's output against a single-selection sub-request so the
        // shared validator injects exactly that intent's pivot variable.
        const recipe = parseRecipe(text, { ...request, selections: [selection] });
        return { selection, recipe };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    });

    const settled = await Promise.all(jobs);
    const successes: IntentResult[] = [];
    let firstError: Error | null = null;
    for (const entry of settled) {
      if ('recipe' in entry) {
        successes.push(entry);
      } else if (!firstError && entry.error.message !== 'superseded') {
        firstError = entry.error;
      }
    }

    if (successes.length === 0) {
      return { recipe: null, error: firstError };
    }
    return { recipe: mergeIntentRecipes(successes), error: null };
  } finally {
    for (const assistant of created) {
      try {
        assistant.dispose();
      } catch {
        // best-effort cleanup.
      }
    }
  }
}

/**
 * Drives a single agent: sends the per-intent prompt and resolves with the raw
 * completion text. Rejects on error. Falls back to any streamed content if the
 * assistant resolves without firing `onComplete`.
 */
function runIntentAgent(
  assistant: InlineAssistant,
  selection: IntentSelection,
  request: GenerateDashboardRequest,
  mode: JobMode
): Promise<string> {
  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildJobUserPrompt(selection, request, mode);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let streamed = '';
    const finish = (value: string) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const fail = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    assistant
      .sendPrompt({
        agentName: 'generate-dashboard-recipe',
        systemPrompt,
        prompt: userPrompt,
        onDelta: (delta) => {
          streamed += delta;
        },
        onComplete: (text) => finish(text || streamed),
        onError: (err) => fail(err),
      })
      .then(() => finish(streamed))
      .catch(fail);
  });
}

type JobMode = 'standalone' | 'tab';

/**
 * Merges each agent's recipe into one. A single success is returned untouched
 * (it already carries a rich, row-structured layout). Multiple successes each
 * become a TAB whose body is that intent's own rows — i.e. tab → rows → panels —
 * so the combined dashboard stays a scannable set of labelled bands instead of
 * one flat wall of tiles.
 */
function mergeIntentRecipes(results: IntentResult[]): DashboardRecipe {
  if (results.length === 1) {
    return results[0].recipe;
  }

  const sections: RecipeSection[] = [];
  for (const { selection, recipe } of results) {
    const rows = capRowsToBudget(recipeToRows(recipe));
    if (rows.length === 0) {
      continue;
    }
    sections.push({
      title: selection.intent.title,
      kind: 'tab',
      rows,
    });
  }

  const variables = dedupeVariables(results.flatMap((r) => r.recipe.variables ?? [])).slice(0, MAX_VARIABLES);
  const tags = uniqueStrings(['generated', ...results.flatMap((r) => r.recipe.tags ?? [])]).slice(0, 6);
  // Base the title on the intents that actually made it in (an agent may have
  // failed), so it never advertises a tab that isn't there.
  const title = results.map((r) => r.selection.intent.title).join(' + ');

  return {
    title,
    description: `Combined view across ${results.length} concerns: ${results
      .map((r) => r.selection.intent.title)
      .join(', ')}.`,
    tags,
    variables,
    sections,
  };
}

/**
 * Reduces an (already structured) agent recipe to the rows that go inside its
 * tab. Nested rows are lifted as-is; a section without rows becomes a single row
 * from its panels; a recipe with only flat panels is run through the beautifier.
 */
function recipeToRows(recipe: DashboardRecipe): RecipeRow[] {
  const sections = recipe.sections ?? [];
  const rows: RecipeRow[] = [];
  for (const section of sections) {
    if (section.rows?.length) {
      for (const row of section.rows) {
        if (row.panels?.length) {
          rows.push(row);
        }
      }
      continue;
    }
    if (section.panels?.length) {
      rows.push(sectionToRow(section));
    }
  }
  if (rows.length > 0) {
    return rows;
  }
  return structureIntoRows(recipe.panels ?? []).map(sectionToRow);
}

function sectionToRow(section: RecipeSection): RecipeRow {
  return {
    title: section.title,
    panels: section.panels ?? [],
    layout: section.layout,
    collapsed: section.collapsed,
    autoColumns: section.autoColumns,
  };
}

/** Trims a row list so a single tab never blows past the per-tab panel budget. */
function capRowsToBudget(rows: RecipeRow[]): RecipeRow[] {
  let budget = MAX_PANELS_PER_TAB;
  const out: RecipeRow[] = [];
  for (const row of rows) {
    if (budget <= 0 || out.length >= MAX_ROWS_PER_SECTION) {
      break;
    }
    const panels = row.panels.slice(0, budget);
    if (panels.length === 0) {
      continue;
    }
    budget -= panels.length;
    out.push({ ...row, panels });
  }
  return out;
}

/**
 * Ensures a recipe reads as a structured dashboard rather than a flat wall. When
 * the LLM already returned real structure (≥2 sections) we trust it; otherwise we
 * reshape its panels into an "Overview" KPI strip plus typed detail rows.
 */
function structureRecipe(recipe: DashboardRecipe): DashboardRecipe {
  const sections = recipe.sections ?? [];
  if (sections.length >= 2) {
    return recipe;
  }
  const panels = sections.length === 1 ? (sections[0].panels ?? []) : (recipe.panels ?? []);
  const rows = structureIntoRows(panels);
  // Only rewrite when we actually produced multiple bands — wrapping a single
  // homogeneous set in one row would just add ceremony without improving it.
  if (rows.length <= 1) {
    return recipe;
  }
  return { ...recipe, sections: rows, panels: undefined };
}

/**
 * Row titles the beautifier writes into the generated dashboard model. These are
 * dashboard *data* (not UI chrome) and match the English content the LLM produces
 * for the panels alongside them, so they intentionally aren't translated.
 */
const OVERFLOW_ROW_TITLE = 'Details';

/** Ordered role-based grouping used to turn a flat panel list into detail rows. */
const ROW_GROUPS: ReadonlyArray<{ title: string; types: ReadonlySet<RecipePanelType>; layout: RecipeInnerLayout }> = [
  { title: 'Overview', types: new Set<RecipePanelType>(['stat', 'gauge', 'bargauge']), layout: 'auto' },
  { title: 'Trends', types: new Set<RecipePanelType>(['timeseries']), layout: 'grid' },
  { title: 'Distributions', types: new Set<RecipePanelType>(['heatmap']), layout: 'grid' },
  { title: 'Breakdown', types: new Set<RecipePanelType>(['table', 'piechart']), layout: 'grid' },
  { title: 'Logs', types: new Set<RecipePanelType>(['logs']), layout: 'grid' },
];

/**
 * Deterministically reshapes a flat panel list into labelled rows grouped by
 * panel role. KPIs go into a responsive "Overview" strip; trends, tables,
 * heatmaps and logs each get their own row with sensible panel widths. Rows past
 * the second start collapsed so the top of the dashboard stays focused.
 */
function structureIntoRows(panels: RecipePanel[]): RecipeSection[] {
  const remaining = (Array.isArray(panels) ? panels : []).filter((p): p is RecipePanel => Boolean(p));
  if (remaining.length === 0) {
    return [];
  }

  const rows: RecipeSection[] = [];
  for (const group of ROW_GROUPS) {
    const picked: RecipePanel[] = [];
    for (let i = 0; i < remaining.length; i++) {
      if (group.types.has(remaining[i].type)) {
        picked.push(remaining[i]);
      }
    }
    if (picked.length === 0) {
      continue;
    }
    // Remove the picked panels from the pool (preserving the order of the rest).
    for (const panel of picked) {
      const idx = remaining.indexOf(panel);
      if (idx >= 0) {
        remaining.splice(idx, 1);
      }
    }
    const isOverview = group.layout === 'auto';
    rows.push({
      title: group.title,
      kind: 'row',
      panels: assignRowSpans(picked.slice(0, MAX_PANELS_PER_ROW), isOverview),
      layout: group.layout,
    });
  }

  if (remaining.length > 0) {
    rows.push({
      title: OVERFLOW_ROW_TITLE,
      kind: 'row',
      panels: assignRowSpans(remaining.slice(0, MAX_PANELS_PER_ROW), false),
      layout: 'grid',
    });
  }

  // Keep the overview + first detail band open; collapse the rest.
  return rows.map((row, index) => ({ ...row, collapsed: index >= 2 }));
}

/**
 * Gives a grid row visual hierarchy: full-width tables/logs/heatmaps, a wide
 * "hero" first panel when a row is busy, and balanced widths otherwise. Panels
 * that already declared a span are left untouched, and overview rows keep their
 * spans unset because the auto-grid ignores them.
 */
function assignRowSpans(panels: RecipePanel[], isOverview: boolean): RecipePanel[] {
  if (isOverview) {
    return panels;
  }
  const fullWidth = new Set<RecipePanelType>(['table', 'logs', 'heatmap']);
  const count = panels.length;
  return panels.map((panel, index) => {
    if (panel.span) {
      return panel;
    }
    if (fullWidth.has(panel.type)) {
      return { ...panel, span: 24 };
    }
    let span: RecipePanelSpan;
    if (count === 1) {
      span = 24;
    } else if (index === 0 && count >= 4) {
      span = 24;
    } else if (count === 2) {
      span = 12;
    } else if (count === 3) {
      span = 8;
    } else {
      span = 12;
    }
    return { ...panel, span };
  });
}

/** De-duplicates variables by name, keeping the first occurrence. */
function dedupeVariables(variables: RecipeVariable[]): RecipeVariable[] {
  const seen = new Set<string>();
  const out: RecipeVariable[] = [];
  for (const variable of variables) {
    if (seen.has(variable.name)) {
      continue;
    }
    seen.add(variable.name);
    out.push(variable);
  }
  return out;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.length > 0)));
}

/**
 * System prompt teaching the LLM the recipe schema and dashboard-generation
 * rules. Kept as strict JSON to make parsing predictable.
 *
 * The prompt is generated per agent: each agent produces one intent, so the
 * `mode` tunes whether we ask for a full multi-section dashboard (`standalone`,
 * a lone intent) or one dense embeddable view (`tab`, one of several merged
 * intents).
 */
function buildSystemPrompt(mode: JobMode): string {
  return [
    'You produce a Grafana dashboard recipe as strict JSON.',
    '',
    'Output rules:',
    '- Return ONLY a JSON object (no prose, no markdown fences, no commentary).',
    '- Output MINIFIED JSON: a single line, no line breaks, no indentation, and no spaces except inside string values.',
    '- Your entire reply MUST fit within the response limit — a truncated reply is unusable. You are building ONE focused subject, so spend the budget on depth: include the panels that genuinely matter and set units, thresholds and legends where they add meaning, but keep titles and legend formats short and skip fields that add nothing.',
    '- Use double-quoted keys and values. No trailing commas.',
    '- Do NOT invent metric names. The context includes a `metrics` object with REAL metrics sampled from THIS datasource. `metrics.relevant` are the metrics most relevant to this intent; `metrics.families` lists the namespaces present as `prefix* (count)`. Build every query from these. Only reach outside them for a standard name you are confident the exporter emits, and never for one that contradicts the families shown.',
    '- Each `metrics.relevant` entry is an object: `name` (histogram/summary families are given by base name — append `_bucket`/`_sum`/`_count` yourself), optional `type`, optional `unit`, optional `help`. Use `type` to pick the query shape: `counter` → wrap in rate()/increase(); `gauge` → use the value directly (avg/max/sum by the pivot); `histogram` → histogram_quantile(q, sum by (le, ...) (rate(<name>_bucket[$__rate_interval]))); `summary` → use the `quantile` label, or rate(<name>_sum)/rate(<name>_count) for an average. When `unit` is present, set the panel `unit` accordingly; use `help` to title and describe the panel correctly.',
    '- Write queries in the language given by `metrics.query_language` / `primary_datasource.query_language` (PromQL for Prometheus-like stores, LogQL for Loki).',
    '- Respect the datasource convention: if it carries OpenTelemetry semantic-convention metrics use those spellings, if it carries classic Prometheus metrics use those.',
    "- If a signal isn't available on the datasource (not in `metrics` and not a certain standard name), skip that panel rather than making one up.",
    "- Every query's `datasourceUid` must match one of the datasource UIDs listed in the context.",
    '',
    'Recipe schema (all fields case-sensitive):',
    '{',
    '  "title": string,                 // The dashboard title.',
    '  "description": string?,          // 1–2 sentences describing the dashboard.',
    '  "tags": string[]?,               // 0–6 short tags.',
    '  "variables": Variable[]?,',
    '  "sections": Section[]?,          // Preferred. Group panels into tabs or collapsible rows.',
    '  "panels": Panel[]?               // Fallback: flat list rendered as a single grid.',
    '}',
    '',
    'Provide EITHER `sections` OR `panels`. When both are set, `sections` wins.',
    'Prefer `sections` whenever the dashboard has more than one concern worth separating.',
    '',
    'Section = {',
    '  "title": string,                 // Tab label or row header (e.g. "Overview", "Errors", "Latency").',
    '  "kind": "tab"|"row",             // See tab vs row guidance below.',
    '  "panels": Panel[],               // 2–6 panels per section.',
    '  "layout": "grid"|"auto"?,        // Inner layout. Omit to auto-detect: "auto" for uniform stat/gauge strips, "grid" otherwise.',
    '  "collapsed": boolean?,           // Rows only. Start collapsed (use for below-the-fold detail).',
    '  "autoColumns": number?           // "auto" layouts only. Cap tiles-per-row.',
    '}',
    '',
    'Variable = {',
    '  "name": string,                  // e.g. "service". Becomes $name in queries.',
    '  "label": string?,                // Display label.',
    '  "labelKey": string,              // The label to enumerate values for.',
    '  "datasourceUid": string,         // From the datasource context.',
    '  "multi": boolean?,               // Default true.',
    '  "includeAll": boolean?,          // Default true.',
    '  "regex": string?,',
    '  "sort": "alphabeticalAsc"|"alphabeticalDesc"|"numericalAsc"|"numericalDesc"|"disabled"?',
    '}',
    '',
    'Panel = {',
    '  "title": string,',
    '  "description": string?,',
    `  "type": ${ALLOWED_PANEL_TYPES.map((p) => `"${p}"`).join('|')},`,
    '  "queries": Query[],              // 1–3 queries per panel (keep to the essential ones).',
    '  "span": 6|8|12|16|18|24?,        // 24-column grid ("grid" layouts only). Defaults vary by type.',
    '  "height": number?,               // Grid rows ("grid" layouts only). Defaults vary by type.',
    '  "unit": string?,                 // Grafana unit id, e.g. "percent", "reqps", "ms", "bytes", "s".',
    '  "min": number?,',
    '  "max": number?,',
    '  "decimals": number?,',
    '  "thresholds": Threshold[]?,      // First step must have value=null (base).',
    '  "legend": "hidden"|"list"|"table"?,',
    '  "stacking": boolean?',
    '}',
    '',
    'Query = {',
    '  "datasourceUid": string,         // From the datasource context.',
    '  "expr": string,                  // PromQL or LogQL.',
    '  "legendFormat": string?,         // e.g. "{{service}}".',
    '  "refId": string?,                // A, B, C… Auto-assigned when omitted.',
    '  "instant": boolean?,             // Single-point vs range. Use `true` for stat/gauge/bargauge.',
    '  "format": "time_series"|"table"|"heatmap"?',
    '}',
    '',
    'Threshold = { "value": number|null, "color": "green"|"yellow"|"orange"|"red"|"blue"|"purple" }',
    '',
    'Layout & composition (this is what makes a dashboard look good instead of a wall of tiles — follow it closely):',
    '- ALWAYS lead with an "Overview" row: 3–5 headline KPIs as `stat`/`gauge`/`bargauge` with `layout: "auto"`. This renders as a clean responsive strip across the top. Omit `span` here — the auto-grid sizes the tiles.',
    '- Then add 2–4 DETAIL rows (`kind: "row"`), each focused on ONE concern (e.g. "Errors", "Latency", "Saturation", "Throughput", "Resources"), with `layout: "grid"`.',
    '- Give each detail row internal HIERARCHY: one wide "hero" panel (a single trend at `span: 24`, or a `span: 16`–`18` hero beside a `span: 6`–`8` companion) plus supporting panels at `span: 8`–`12`. NEVER make every panel the same width — varied spans are the difference between a real dashboard and a grid of identical boxes.',
    '- Tables, logs and heatmaps read best full width — give them `span: 24`, each on its own line.',
    '- Put the deepest drill-down rows below the fold with `collapsed: true`, so the overview and the first one or two detail rows lead.',
    '- Use tabs (`kind: "tab"`) ONLY for genuinely independent facets the user inspects one at a time. For a single subject, PREFER rows — a scannable top-to-bottom story beats hidden tabs.',
    '- Vary the inner layout: `auto` for the uniform KPI strip, `grid` for the mixed detail rows. Do not make the whole dashboard one repeated grid.',
    '',
    'Panel guidelines:',
    '- Use `stat` for KPIs (current value / count), `gauge` / `bargauge` for bounded ratios, `timeseries` for trends, `table` for top-N breakdowns, `heatmap` for latency distributions, `logs` for log panels on Loki datasources.',
    '- Mix panel types — a good dashboard uses at least three different types across its rows (e.g. stats + timeseries + table + heatmap).',
    '- For rate-like metrics use rate() with a range that respects the panel default resolution (5m or $__rate_interval).',
    '- For latency use histogram_quantile over the appropriate _bucket metric. Include p50 / p95 / p99 when available.',
    '- When a template variable is present, add `{label=~"$name"}` (or the appropriate matcher) to every panel query so the dashboard filters correctly.',
    '- Order rows from most important (top) to least (bottom), and panels most-important-first (top-left) within each row.',
    '',
    mode === 'tab'
      ? 'This recipe is ONE subject that will be embedded as a single tab of a larger dashboard. Return `sections` shaped as ROWS: an "Overview" `auto` KPI row followed by 2–3 `grid` detail rows (8–14 panels total). Do NOT use `kind: "tab"` and do NOT return a flat `panels` list.'
      : 'This recipe is a standalone dashboard. Return `sections` shaped as ROWS: an "Overview" `auto` KPI row followed by 3–4 `grid` detail rows (12–18 panels total). Reserve `kind: "tab"` for truly independent facets only.',
    '',
    'Answer with the minified JSON object only, on a single line.',
  ].join('\n');
}

/**
 * Builds the user prompt for a single intent's agent. `standalone` asks for a
 * complete multi-section dashboard (the lone intent gets the whole screen);
 * `tab` asks for one dense, flat view we later embed as a tab of the merged
 * dashboard.
 */
function buildJobUserPrompt(selection: IntentSelection, request: GenerateDashboardRequest, mode: JobMode): string {
  const { primaryDatasource, additionalDatasources, analysis, customization } = request;
  const labelKeys = analysis.labelKeys.slice(0, MAX_LABEL_KEYS_IN_PROMPT);
  const labelSamples: Record<string, string[]> = {};
  for (const key of labelKeys) {
    const values = analysis.labelSamples[key];
    if (values?.length) {
      labelSamples[key] = values.slice(0, MAX_SAMPLE_VALUES_PER_LABEL);
    }
  }

  const capabilities = summariseCapabilities(analysis.capabilities);
  const notes = customization.additionalNotes.trim();
  const variableName = suggestVariableName(selection.option.labelKey);

  // Ground the model in REAL metric names: the ones most relevant to this intent
  // plus a compact overview of the whole namespace. This is the single biggest
  // lever on query accuracy — it stops the LLM inventing plausible-but-wrong names.
  const relevantMetrics = selectRelevantMetrics(selection, analysis.capabilities, MAX_RELEVANT_METRICS_IN_PROMPT);
  const metricFamilies = formatMetricFamilies(analysis.capabilities.metricFamilies, MAX_METRIC_FAMILIES_IN_PROMPT);
  const queryLanguage = queryLanguageHint(analysis.capabilities, primaryDatasource.type);
  const metrics =
    relevantMetrics.length || metricFamilies.length
      ? {
          query_language: queryLanguage,
          relevant: describeRelevantMetrics(relevantMetrics, analysis.capabilities.metricMetadata),
          families: metricFamilies,
        }
      : undefined;

  // We hand the LLM the exact variable name so its queries reference the same
  // `$name` we inject during parsing.
  const intentPayload = {
    id: selection.intent.id,
    title: selection.intent.title,
    description: selection.intent.description,
    guidance: selection.intent.guidance,
    pivot: {
      label_key: selection.option.labelKey,
      title: selection.option.title,
      variable_name: variableName,
      sample_values: (selection.option.sampleValues ?? []).slice(0, MAX_SAMPLE_VALUES_PER_LABEL),
      equivalent_label_keys: selection.option.mergedLabelKeys ?? [],
    },
  };

  const panelTarget =
    mode === 'tab'
      ? { min: 8, max: 14, human_readable: 'a dense 8–14 panel view' }
      : { min: 12, max: 18, human_readable: 'an in-depth 12–18 panel dashboard' };

  const payload = {
    intent: intentPayload,
    primary_datasource: {
      uid: primaryDatasource.uid,
      name: primaryDatasource.name,
      type: primaryDatasource.type,
      query_language: queryLanguage,
    },
    additional_datasources: additionalDatasources.map((ds) => ({
      uid: ds.uid,
      name: ds.name,
      type: ds.type,
    })),
    label_keys_discovered: labelKeys,
    label_samples: labelSamples,
    capabilities,
    metrics,
    customization: {
      panel_count_target: panelTarget,
      additional_notes: notes || undefined,
    },
  };

  const variableLine = `Include exactly one template variable named "${variableName}" for the "${selection.option.labelKey}" label, sourced from ${primaryDatasource.name}. Every panel query must filter by $${variableName}.`;
  const notesLine = notes
    ? `The user added these notes — treat them as authoritative: ${JSON.stringify(notes)}.`
    : 'No additional notes from the user.';

  if (mode === 'tab') {
    return [
      'Context (JSON):',
      JSON.stringify(payload, null, 2),
      '',
      `Produce ONE cohesive, well-organised Grafana view for the single concern "${selection.intent.title}", pivoting on ${selection.option.labelKey}. It will be embedded as a tab of a larger dashboard.`,
      variableLine,
      'Shape it as `sections` = ROWS: first an "Overview" row (`layout: "auto"`) of 3–5 KPI stats/gauges, then 2–3 `grid` detail rows each focused on one facet with a wide hero panel plus narrower supporting panels. Use at least four different panel types across the rows and vary the panel spans. Do NOT use `kind: "tab"`.',
      `Target ${panelTarget.human_readable}.`,
      notesLine,
      '',
      'Reply with the JSON recipe only.',
    ].join('\n');
  }

  return [
    'Context (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    `Produce a comprehensive, well-composed Grafana dashboard recipe for the "${selection.intent.title}" intent, pivoting on ${selection.option.labelKey}.`,
    variableLine,
    `Target ${panelTarget.human_readable} split across rows.`,
    layoutHintForSelections([selection]),
    notesLine,
    '',
    'Reply with the JSON recipe only.',
  ].join('\n');
}

/** Distinct pivot dimensions across selections, preserving first-seen order. */
function uniquePivots(selections: IntentSelection[]): ExplorationOption[] {
  const seen = new Set<string>();
  const out: ExplorationOption[] = [];
  for (const { option } of selections) {
    if (!seen.has(option.labelKey)) {
      seen.add(option.labelKey);
      out.push(option);
    }
  }
  return out;
}

/**
 * Layout hint for a standalone (single-intent) dashboard. Always steers toward an
 * overview-first stack of rows — that reliably produces a good-looking, scannable
 * dashboard — and uses the intent's curated preference only to tune how much of
 * the detail lives below the fold.
 *
 * This only drives `standalone` mode — multi-intent requests fan out into one
 * agent per intent and are merged into tabs client-side, so there's no single
 * prompt that needs to describe several intents at once.
 */
function layoutHintForSelections(selections: IntentSelection[]): string {
  const intent = selections[0]?.intent;
  const preferredKind = intent ? (INTENT_LAYOUT_KIND[intent.id] ?? defaultLayoutKindForIntent(intent.id)) : 'row';
  const foldHint =
    preferredKind === 'tab'
      ? 'This is a detail-heavy subject: give the later rows rich drill-down panels and start the deepest ones collapsed.'
      : 'This is a scannable subject: keep most rows expanded so the story reads top to bottom.';
  return [
    'Structure it as an overview-first STACK OF ROWS (`sections` with `kind: "row"`):',
    'row 1 "Overview" with `layout: "auto"` and 3–5 KPI stats/gauges (no spans);',
    'then 3–4 `grid` detail rows, each one concern with a wide hero panel (span 16–24) plus 2–3 supporting panels (span 6–12).',
    'Vary panel widths and mix at least three panel types across the rows.',
    foldHint,
  ].join(' ');
}

/**
 * Curated per-intent layout preference. The keys match the intent ids declared in
 * `intents.ts`. Intents not in this map fall back to
 * {@link defaultLayoutKindForIntent} which does a keyword-based guess.
 */
const INTENT_LAYOUT_KIND: Record<string, 'tab' | 'row'> = {
  // Service intents — usually deep drill-downs the user picks one facet at a time.
  'service-health': 'tab',
  'runtime-metrics': 'tab',
  'errors-latency': 'tab',
  'traffic-dependencies': 'row',
  'saturation-throughput': 'row',
  'slo-error-budget': 'row',
  // Kubernetes intents.
  'cluster-overview': 'row',
  'cluster-capacity': 'row',
  'cluster-node-health': 'tab',
  'cluster-control-plane': 'tab',
  'pod-resources': 'tab',
  'pod-lifecycle': 'row',
  'pod-throttling': 'row',
  'pod-network': 'row',
  'container-resources': 'tab',
  'container-restarts': 'row',
  'container-limits': 'row',
  'k8s-pod-rollout': 'tab',
  // Namespace intents.
  'workload-overview': 'row',
  'resource-usage': 'row',
  'namespace-quotas': 'row',
  'namespace-costs': 'row',
  'namespace-events': 'row',
  // Host / instance intents.
  'host-overview': 'tab',
  'host-disk-io': 'row',
  'host-network': 'row',
  'host-fleet': 'row',
  // Databases.
  'postgres-query-performance': 'tab',
  'postgres-connections-locks': 'row',
  'mysql-overview': 'row',
  'redis-overview': 'row',
  'mongodb-overview': 'row',
  // Messaging.
  'kafka-consumer-lag': 'tab',
  'kafka-broker-health': 'row',
  // Observability / mesh / runtimes.
  'otel-red-semconv': 'tab',
  'istio-service-mesh': 'tab',
  'envoy-proxy': 'tab',
  'jvm-runtime-deep-dive': 'tab',
  'go-runtime-deep-dive': 'tab',
  'nodejs-runtime': 'tab',
  'python-runtime': 'tab',
  'dotnet-runtime': 'tab',
  'ruby-runtime': 'tab',
  // Cloud.
  'aws-cloudwatch-overview': 'tab',
};

function defaultLayoutKindForIntent(id: string): 'tab' | 'row' {
  const lower = id.toLowerCase();
  if (/(health|runtime|proxy|mesh|deep-dive|overview)/.test(lower)) {
    return 'tab';
  }
  return 'row';
}

// A previous iteration exposed an `intentFromFreeformPrompt` helper that surfaced a
// dedicated freeform prompt textarea in the modal. We removed the textarea because
// the "Additional notes" field under Advanced options is a strictly better home for
// user-authored guidance — it layers on top of an intent's baseline instead of
// competing with it, and it doesn't need its own screen real estate.

/**
 * Trims the capabilities snapshot to the fields most useful for prompt guidance,
 * skipping empty categories so the LLM isn't distracted by noise.
 */
function summariseCapabilities(capabilities: DatasourceCapabilities): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (capabilities.metricConventions.length) {
    out.metric_conventions = capabilities.metricConventions;
  }
  if (capabilities.kubernetes.detected) {
    out.kubernetes = capabilities.kubernetes;
  }
  if (capabilities.databases.length) {
    out.databases = capabilities.databases;
  }
  if (capabilities.clouds.length) {
    out.clouds = capabilities.clouds;
  }
  if (capabilities.serviceMesh.length) {
    out.service_mesh = capabilities.serviceMesh;
  }
  if (capabilities.runtimes.length) {
    out.runtimes = capabilities.runtimes;
  }
  // Metric names are forwarded per-intent (curated + families) rather than here,
  // so the LLM sees the names that matter for the concern it's building.
  return out;
}

/**
 * The query language the LLM should write for the primary datasource. Prometheus-
 * like stores use PromQL, Loki uses LogQL; anything else gets a datasource-specific
 * nudge so the model doesn't default to PromQL for e.g. CloudWatch.
 */
function queryLanguageHint(capabilities: DatasourceCapabilities, datasourceType: string): string {
  if (capabilities.isLokiLike) {
    return 'LogQL';
  }
  if (capabilities.isPrometheusLike) {
    return 'PromQL';
  }
  return `the native query language of the "${datasourceType}" datasource`;
}

/**
 * A metric name paired with its relevance score for a given intent — the sort key
 * used to pick which real metrics we surface to the LLM.
 */
interface ScoredMetric {
  name: string;
  score: number;
}

/** Metric-name tokens too generic to signal relevance on their own. */
const METRIC_STOPWORD_TOKENS: ReadonlySet<string> = new Set([
  'total',
  'sum',
  'count',
  'bucket',
  'info',
  'seconds',
  'bytes',
  'ratio',
  'created',
  'the',
  'and',
  'for',
  'with',
  'per',
  'use',
  'a',
  'to',
  'of',
]);

/** Metric families that are usually collection noise unless the intent is specifically about them. */
const NOISE_METRIC_PATTERNS: readonly RegExp[] = [
  /^scrape_/,
  /^promhttp_/,
  /^prometheus_/,
  /^net_conntrack_/,
  /^go_(gc|memstats|sched|threads|info)/,
  /^process_(start_time|max_fds|virtual_memory_max)/,
];

/**
 * Maps a detected capability / intent to the metric-name prefixes it cares about.
 * Weighted so a strong, specific family (an exporter or runtime prefix) outranks a
 * generic keyword overlap.
 */
function metricRelevanceBoosts(
  selection: IntentSelection,
  capabilities: DatasourceCapabilities
): Array<{ pattern: RegExp; weight: number }> {
  const boosts: Array<{ pattern: RegExp; weight: number }> = [];
  const add = (pattern: RegExp, weight: number) => boosts.push({ pattern, weight });

  const dbPrefixes: Record<string, RegExp> = {
    postgres: /^(pg_|postgres|pgbouncer)/,
    mysql: /^(mysql_|mysqld_|mariadb_)/,
    redis: /^redis_/,
    mongodb: /^mongodb_/,
    kafka: /^kafka_/,
    elasticsearch: /^(elasticsearch_|opensearch_)/,
    cassandra: /^(cassandra_|scylladb_)/,
  };
  for (const db of capabilities.databases) {
    const pattern = dbPrefixes[db];
    if (pattern) {
      add(pattern, 8);
    }
  }

  const runtimePrefixes: Record<string, RegExp> = {
    go: /^(go_|process_runtime_go_)/,
    jvm: /^(jvm_|process_runtime_jvm_)/,
    nodejs: /^(nodejs_|process_runtime_nodejs_)/,
    python: /^(python_|process_runtime_cpython_|process_runtime_python_)/,
    dotnet: /^(dotnet_|process_runtime_dotnet_)/,
    ruby: /^(ruby_|process_runtime_ruby_)/,
  };
  for (const runtime of capabilities.runtimes) {
    const pattern = runtimePrefixes[runtime];
    if (pattern) {
      add(pattern, 6);
    }
  }

  if (capabilities.kubernetes.detected) {
    add(/^(kube_|container_|node_|apiserver_|etcd_|kubelet_|cadvisor_)/, 5);
  }
  for (const mesh of capabilities.serviceMesh) {
    if (mesh === 'istio') {
      add(/^istio_/, 8);
    } else if (mesh === 'envoy') {
      add(/^envoy_/, 8);
    } else if (mesh === 'linkerd') {
      add(/^(linkerd_|response_latency_)/, 8);
    }
  }

  // Generic RED/USE signals — always mildly relevant for app-facing intents.
  add(/(request|requests|http_|grpc_|rpc_)/, 3);
  add(/(error|errors|failed|failures)/, 3);
  add(/(duration|latency|_seconds_bucket$)/, 3);
  add(/(cpu|memory|mem_|rss|heap|disk|fs_|filesystem|network|net_)/, 2);
  add(/(saturation|queue|backlog|pending|inflight|utilization|utilisation)/, 2);

  return boosts;
}

/** Extracts meaningful lowercase tokens from an intent's id / title / guidance. */
function intentKeywordTokens(selection: IntentSelection): Set<string> {
  const text = `${selection.intent.id} ${selection.intent.title} ${selection.intent.guidance}`.toLowerCase();
  const tokens = text.split(/[^a-z0-9]+/).filter((tok) => tok.length >= 3 && !METRIC_STOPWORD_TOKENS.has(tok));
  return new Set(tokens);
}

/** Splits a metric name into comparable lowercase tokens (dropping generic suffixes). */
function tokenizeMetricName(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !METRIC_STOPWORD_TOKENS.has(tok));
}

/**
 * Collapses histogram / summary members to their base name so we don't waste
 * slots on `_bucket` + `_sum` + `_count` for the same metric. The base name tells
 * the LLM the family exists; it knows how to reach the parts.
 */
function dedupeMetricBases(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const base = name.replace(/_(bucket|sum|count)$/, '');
    if (seen.has(base)) {
      continue;
    }
    seen.add(base);
    out.push(base);
  }
  return out;
}

/**
 * Ranks the datasource's sampled metric names by relevance to a specific intent and
 * returns the top slice. Relevance combines capability/RED-USE prefix boosts with
 * keyword overlap against the intent's guidance, minus a penalty for collection
 * noise. Falls back to a breadth sample when nothing scores (generic datasource).
 */
function selectRelevantMetrics(
  selection: IntentSelection,
  capabilities: DatasourceCapabilities,
  limit: number
): string[] {
  const pool = capabilities.sampledMetricNames;
  if (!pool.length) {
    return [];
  }

  const boosts = metricRelevanceBoosts(selection, capabilities);
  const keywords = intentKeywordTokens(selection);

  const scored: ScoredMetric[] = [];
  for (const name of pool) {
    let score = 0;
    for (const { pattern, weight } of boosts) {
      if (pattern.test(name)) {
        score += weight;
      }
    }
    const nameTokens = tokenizeMetricName(name);
    for (const token of nameTokens) {
      if (keywords.has(token)) {
        score += 4;
      }
    }
    if (score <= 0 && NOISE_METRIC_PATTERNS.some((pattern) => pattern.test(name))) {
      continue;
    }
    if (score > 0) {
      scored.push({ name, score });
    }
  }

  if (!scored.length) {
    // Nothing matched — hand back a representative breadth sample so the LLM still
    // sees real names rather than nothing.
    return dedupeMetricBases(pool).slice(0, limit);
  }

  scored.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return dedupeMetricBases(scored.map((s) => s.name)).slice(0, limit);
}

/** Renders the metric-family overview as compact `prefix* (count)` strings. */
function formatMetricFamilies(families: MetricFamily[], limit: number): string[] {
  return families.slice(0, limit).map((family) => `${family.prefix}* (${family.count})`);
}

/** A curated metric plus whatever metadata we have for it, as forwarded to the LLM. */
interface RelevantMetric {
  name: string;
  type?: MetricType;
  unit?: string;
  help?: string;
}

/**
 * Attaches metric metadata (type / unit / help) to the curated metric names so the
 * LLM knows how to query each one — rate() a counter, histogram_quantile a
 * histogram, read a gauge directly — and which panel unit to set.
 */
function describeRelevantMetrics(names: string[], metadata: Record<string, MetricMeta>): RelevantMetric[] {
  return names.map((name) => {
    const meta = metadata[name];
    if (!meta) {
      return { name };
    }
    return {
      name,
      // `unknown` carries no query-shape signal, so omit it rather than mislead.
      type: meta.type !== 'unknown' ? meta.type : undefined,
      unit: meta.unit,
      help: meta.help,
    };
  });
}

/**
 * Suggests a canonical variable name for a label key, matching the conventions the
 * Assistant prompt library already uses (`service` for `service_name`, `pod` for
 * `pod_name`, ...). Composer accepts anything, but consistency helps humans.
 */
function suggestVariableName(labelKey: string): string {
  const canonical: Record<string, string> = {
    service_name: 'service',
    k8s_namespace: 'namespace',
    kubernetes_namespace: 'namespace',
    pod_name: 'pod',
    k8s_pod_name: 'pod',
    container_name: 'container',
    hostname: 'instance',
    host: 'instance',
  };
  return canonical[labelKey] ?? labelKey;
}

/**
 * Parses and validates the LLM's response into a strict {@link DashboardRecipe}.
 * Any missing / invalid fields are patched up with request-derived fallbacks so
 * we never throw solely because the LLM omitted a nice-to-have detail.
 */
export function parseRecipe(raw: string, request: GenerateDashboardRequest): DashboardRecipe {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new Error('Assistant response did not contain a JSON object.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    // The inline Assistant caps output tokens, so a large recipe can arrive cut
    // off mid-string. Try to recover the structurally-valid prefix rather than
    // failing outright — downstream validation drops any malformed panels/queries.
    const repaired = repairTruncatedJson(jsonText);
    if (repaired === null) {
      throw new Error(`Assistant response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    parsed = JSON.parse(repaired);
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Assistant response was not a JSON object.');
  }

  const known = new Set([request.primaryDatasource.uid, ...request.additionalDatasources.map((ds) => ds.uid)]);
  const primary = request.selections[0];
  const fallbackTitle =
    request.selections.length > 1
      ? request.selections.map((s) => s.intent.title).join(' + ')
      : `${primary.intent.title} — ${primary.option.title}`;

  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fallbackTitle;
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : primary.intent.description;
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 6)
    : [];

  const variables = Array.isArray(parsed.variables)
    ? parsed.variables
        .map((v) => toVariable(v, known, request))
        .filter((v): v is RecipeVariable => v !== null)
        .slice(0, MAX_VARIABLES)
    : [];

  // Ensure every pivot dimension the user selected is present as a variable — this
  // is what the wizard promises, and each tab's panel queries should be able to
  // reference their own dimension's variable. We prepend missing ones in reverse so
  // the primary selection's variable ends up first.
  for (const option of uniquePivots(request.selections).reverse()) {
    const varName = suggestVariableName(option.labelKey);
    if (!variables.some((v) => v.name === varName)) {
      variables.unshift({
        name: varName,
        label: option.title,
        labelKey: option.labelKey,
        datasourceUid: request.primaryDatasource.uid,
        multi: true,
        includeAll: true,
        sort: 'alphabeticalAsc',
      });
    }
  }
  // Trim again in case adding pivot variables pushed us over the ceiling.
  if (variables.length > MAX_VARIABLES) {
    variables.length = MAX_VARIABLES;
  }

  // Prefer sections over a flat panel list when both are present. Sections are
  // trimmed independently so a malformed section doesn't throw away the whole
  // recipe — we still accept it as long as *some* panels landed somewhere.
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  let sections = rawSections
    .map((s) => toSection(s, known, request))
    .filter((s): s is RecipeSection => s !== null && (s.panels?.length ?? 0) > 0)
    .slice(0, MAX_SECTIONS);

  const totalSectionPanels = sections.reduce((n, s) => n + (s.panels?.length ?? 0), 0);
  if (totalSectionPanels > MAX_PANELS) {
    // Preserve section ordering but drop panels beyond the global cap.
    let budget = MAX_PANELS;
    sections = sections
      .map((section) => {
        const current = section.panels ?? [];
        if (budget <= 0) {
          return { ...section, panels: [] };
        }
        const trimmed = current.slice(0, Math.min(current.length, budget));
        budget -= trimmed.length;
        return { ...section, panels: trimmed };
      })
      .filter((s) => (s.panels?.length ?? 0) > 0);
  }

  const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];
  const panels = rawPanels
    .map((p) => toPanel(p, known, request))
    .filter((p): p is RecipePanel => p !== null)
    .slice(0, MAX_PANELS);

  if (sections.length === 0 && panels.length === 0) {
    throw new Error('Assistant did not return any panels.');
  }

  // Run the beautifier last: if the model returned a flat panel list (or a single
  // catch-all section), reshape it into an Overview strip + typed detail rows so
  // it never renders as an undifferentiated wall of tiles.
  return structureRecipe({
    title,
    description,
    tags,
    variables,
    sections: sections.length > 0 ? sections : undefined,
    panels: sections.length > 0 ? undefined : panels,
  });
}

function toSection(
  value: unknown,
  knownDatasourceUids: Set<string>,
  request: GenerateDashboardRequest
): RecipeSection | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const rawPanels = Array.isArray(value.panels) ? value.panels : [];
  const panels = rawPanels
    .map((p) => toPanel(p, knownDatasourceUids, request))
    .filter((p): p is RecipePanel => p !== null)
    .slice(0, MAX_PANELS_PER_SECTION);
  if (panels.length === 0) {
    return null;
  }

  const kind: RecipeSectionKind = isOneOf(value.kind, ALLOWED_SECTION_KINDS) ? value.kind : 'row';
  // Leave the inner layout unset unless the model was explicit — the composer
  // auto-detects (auto for uniform stat strips, grid otherwise), which produces
  // more varied, better-looking rows than always defaulting to a grid.
  const layout: RecipeInnerLayout | undefined = isOneOf(value.layout, ALLOWED_INNER_LAYOUTS) ? value.layout : undefined;

  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Section',
    kind,
    panels,
    layout,
    collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : undefined,
    autoColumns:
      typeof value.autoColumns === 'number' && Number.isFinite(value.autoColumns) ? value.autoColumns : undefined,
  };
}

function toVariable(
  value: unknown,
  knownDatasourceUids: Set<string>,
  request: GenerateDashboardRequest
): RecipeVariable | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const labelKey = typeof value.labelKey === 'string' ? value.labelKey.trim() : '';
  if (!name || !labelKey) {
    return null;
  }

  const datasourceUid =
    typeof value.datasourceUid === 'string' && knownDatasourceUids.has(value.datasourceUid)
      ? value.datasourceUid
      : request.primaryDatasource.uid;

  return {
    name: sanitizeIdentifier(name),
    label: typeof value.label === 'string' ? value.label : undefined,
    labelKey,
    datasourceUid,
    multi: typeof value.multi === 'boolean' ? value.multi : true,
    includeAll: typeof value.includeAll === 'boolean' ? value.includeAll : true,
    regex: typeof value.regex === 'string' ? value.regex : undefined,
    sort: isOneOf(value.sort, ALLOWED_SORTS) ? value.sort : 'alphabeticalAsc',
  };
}

function toPanel(
  value: unknown,
  knownDatasourceUids: Set<string>,
  request: GenerateDashboardRequest
): RecipePanel | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const rawQueries = Array.isArray(value.queries) ? value.queries : [];
  const queries = rawQueries
    .map((q) => toQuery(q, knownDatasourceUids, request))
    .filter((q): q is RecipeQuery => q !== null)
    .slice(0, 5);
  if (queries.length === 0) {
    return null;
  }

  const type: RecipePanelType = isOneOf(value.type, ALLOWED_PANEL_TYPES) ? value.type : 'timeseries';

  const panel: RecipePanel = {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Panel',
    description: typeof value.description === 'string' ? value.description : undefined,
    type,
    queries,
    span: isAllowedSpan(value.span) ? value.span : undefined,
    height: typeof value.height === 'number' && Number.isFinite(value.height) ? value.height : undefined,
    unit: typeof value.unit === 'string' ? value.unit : undefined,
    min: typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : undefined,
    max: typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : undefined,
    decimals: typeof value.decimals === 'number' && Number.isFinite(value.decimals) ? value.decimals : undefined,
    thresholds: Array.isArray(value.thresholds)
      ? value.thresholds.map(toThreshold).filter((t): t is RecipeThreshold => t !== null)
      : undefined,
    legend: isOneOf(value.legend, ALLOWED_LEGENDS) ? value.legend : undefined,
    stacking: typeof value.stacking === 'boolean' ? value.stacking : undefined,
  };
  return panel;
}

function isAllowedSpan(value: unknown): value is RecipePanelSpan {
  if (typeof value !== 'number') {
    return false;
  }
  for (const allowed of ALLOWED_SPANS) {
    if (allowed === value) {
      return true;
    }
  }
  return false;
}

function toQuery(
  value: unknown,
  knownDatasourceUids: Set<string>,
  request: GenerateDashboardRequest
): RecipeQuery | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const expr = typeof value.expr === 'string' ? value.expr : '';
  if (!expr.trim()) {
    return null;
  }
  const datasourceUid =
    typeof value.datasourceUid === 'string' && knownDatasourceUids.has(value.datasourceUid)
      ? value.datasourceUid
      : request.primaryDatasource.uid;

  return {
    datasourceUid,
    expr,
    legendFormat: typeof value.legendFormat === 'string' ? value.legendFormat : undefined,
    refId: typeof value.refId === 'string' ? value.refId : undefined,
    instant: typeof value.instant === 'boolean' ? value.instant : undefined,
    format:
      value.format === 'time_series' || value.format === 'table' || value.format === 'heatmap'
        ? value.format
        : undefined,
  };
}

function toThreshold(value: unknown): RecipeThreshold | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const rawValue = value.value;
  const parsedValue: number | null =
    rawValue === null || rawValue === undefined
      ? null
      : typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? rawValue
        : null;
  const color = normaliseColor(value.color);
  return { value: parsedValue, color };
}

/** Coerces an arbitrary value to a valid `RecipeThresholdColor` or `'green'` fallback. */
function normaliseColor(color: unknown): RecipeThresholdColor {
  if (typeof color !== 'string') {
    return 'green';
  }
  const lower = color.toLowerCase();
  for (const allowed of ALLOWED_COLORS) {
    if (allowed === lower) {
      return allowed;
    }
  }
  return 'green';
}

/**
 * Extracts a JSON object from raw LLM output. Handles the common failure modes:
 * markdown code fences and prose before/after the JSON body. Tolerates a missing
 * closing brace (truncated output) — {@link repairTruncatedJson} handles recovery.
 */
function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return trimmed;
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('{')) {
      return inner;
    }
  }
  const start = trimmed.indexOf('{');
  if (start === -1) {
    return null;
  }
  const end = trimmed.lastIndexOf('}');
  // When the body is truncated there may be no closing brace; take everything
  // from the first `{` to the end and let the parser/repair step sort it out.
  return end > start ? trimmed.slice(start, end + 1) : trimmed.slice(start);
}

/**
 * Best-effort recovery of a JSON object cut off mid-generation. The inline
 * Assistant caps output tokens, so large recipes can arrive truncated (e.g. an
 * unterminated string deep inside a panels array). We rewind to the last
 * structurally safe boundary and close any still-open arrays/objects.
 *
 * The result is intentionally conservative: the trailing incomplete element is
 * dropped rather than guessed at. Returns the repaired JSON string, or `null`
 * when no valid prefix can be recovered.
 */
function repairTruncatedJson(text: string): string | null {
  interface Frame {
    open: '{' | '[';
    // Offset (exclusive) of the last point at which this container held only
    // complete elements — a safe place to truncate before closing it.
    safeEnd: number;
  }
  const stack: Frame[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push({ open: ch, safeEnd: i + 1 });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      const parent = stack[stack.length - 1];
      if (parent) {
        // The child value that just closed is a complete element of its parent.
        parent.safeEnd = i + 1;
      }
    } else if (ch === ',') {
      const top = stack[stack.length - 1];
      if (top) {
        // Everything before the comma is a complete element (comma excluded).
        top.safeEnd = i;
      }
    }
  }

  if (stack.length === 0) {
    return null;
  }

  // Cheap path: if we didn't stop mid-string, appending the missing closers may
  // already yield valid JSON (e.g. `{"a":[1,2` -> `{"a":[1,2]}`).
  if (!inString) {
    const closed = text + closersFor(stack);
    if (isParseable(closed)) {
      return closed;
    }
  }

  // Otherwise rewind to the innermost container's last safe boundary, drop the
  // partial tail, and close everything that was open at that point.
  const innermost = stack[stack.length - 1];
  const repaired = text.slice(0, innermost.safeEnd) + closersFor(stack);
  return isParseable(repaired) ? repaired : null;
}

function closersFor(stack: Array<{ open: '{' | '[' }>): string {
  let out = '';
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i].open === '{' ? '}' : ']';
  }
  return out;
}

function isParseable(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Runtime membership test with a compile-time narrow return type. Used in place
 * of `as` casts to satisfy the lint rule against inline type assertions.
 */
function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  if (typeof value !== 'string') {
    return false;
  }
  for (const option of allowed) {
    if (option === value) {
      return true;
    }
  }
  return false;
}

function sanitizeIdentifier(input: string): string {
  const cleaned = input
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1');
  return cleaned || 'variable';
}
