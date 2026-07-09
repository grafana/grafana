import { useCallback, useEffect, useRef, useState } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import { descriptionForLabelKey, titleForLabelKey } from './analysis';
import {
  type DashboardIntent,
  type DatasourceAnalysis,
  type ExplorationOption,
  type GeneratedCategoryGroup,
  type IntentGenerationContext,
  type IntentSelection,
} from './types';

/**
 * Icons the inline Assistant is allowed to pick for a generated intent. We keep the
 * list small and observability-oriented so the LLM output stays predictable and every
 * `iconHint` maps to a real Grafana `IconName`.
 */
const ALLOWED_ICONS: readonly IconName[] = [
  'graph-bar',
  'chart-line',
  'process',
  'sitemap',
  'apps',
  'shield',
  'database',
  'monitor',
  'tachometer-fast',
  'heart-rate',
  'sync',
  'clock-nine',
  'bell',
  'kubernetes',
  'laptop-cloud',
  'cog',
  'columns',
  'list-ul',
  'exclamation-triangle',
  'history',
  'dollar-alt',
];

/** Icon used when the LLM either omits `iconHint` or picks one we don't allow. */
const FALLBACK_ICON: IconName = 'ai-sparkle';

/**
 * How many intents the LLM is allowed to produce in a single response. The
 * modal-facing UI is grouped by category, so a generous ceiling still stays
 * scannable; the LLM decides how many categories to spread them across.
 */
const MAX_SUGGESTIONS = 14;

/** Ceiling on categories so the modal never becomes a wall of thin bands. */
const MAX_CATEGORIES = 6;

/**
 * Upper bound on how much analysis snapshot we send to the LLM. Prevents runaway prompts
 * on datasources with hundreds of labels.
 */
const MAX_LABEL_KEYS_IN_PROMPT = 20;
const MAX_SAMPLE_VALUES_IN_PROMPT = 6;
/** Dimensions (exploration options) we describe to the LLM as valid pivots. */
const MAX_DIMENSIONS_IN_PROMPT = 8;
/** Metric families (namespace overview) we describe so suggestions match real metrics. */
const MAX_METRIC_FAMILIES_IN_PROMPT = 20;
/** Representative real metric names we surface so guidance can reference actual metrics. */
const MAX_SAMPLE_METRICS_IN_PROMPT = 40;
/** Detected log fields we describe when the datasource is a Loki-like log store. */
const MAX_DETECTED_LOG_FIELDS_IN_PROMPT = 24;

interface RequestArgs {
  primaryDatasource: DataSourceInstanceSettings;
  analysis: DatasourceAnalysis;
  /**
   * Titles of intents already shown to the user (from static fallbacks or a
   * prior generation), so the LLM avoids duplicates. Pass `[]` for a fresh
   * datasource-wide pass.
   */
  existingTitles: string[];
  /**
   * Wizard mode, orientation and free-form refinement the user supplied in the
   * modal. Threaded straight into the LLM prompt so the suggestions bias toward
   * the user's target subject and audience.
   */
  context: IntentGenerationContext;
}

/**
 * Category-icon vocabulary the LLM is asked to pick from. Kept small so we can
 * validate the response against real Grafana icons and never surface an unknown
 * name.
 */
const ALLOWED_CATEGORY_ICONS: readonly IconName[] = [
  'apps',
  'sitemap',
  'database',
  'exchange-alt',
  'kubernetes',
  'laptop-cloud',
  'cloud',
  'process',
  'shield',
  'dollar-alt',
  'chart-line',
  'graph-bar',
  'layer-group',
  'bell',
  'clock-nine',
  'history',
  'list-ul',
  'columns',
  'monitor',
  'exclamation-triangle',
];

const FALLBACK_CATEGORY_ICON: IconName = 'layer-group';

/** A parsed suggestion before we resolve its `labelKey` to a concrete pivot dimension. */
interface SuggestedIntent extends DashboardIntent {
  /** The label key the LLM chose to pivot this shape on, if any. */
  labelKey?: string;
  /** Category id the LLM assigned this intent to. Must match one of the returned categories. */
  categoryId?: string;
}

/**
 * A raw category descriptor from the LLM before it's associated with any
 * resolved selections.
 */
interface SuggestedCategory {
  id: string;
  title: string;
  icon: IconName;
  description?: string;
}

/**
 * Lifecycle of an intent-suggestion request. Callers use this to sequence UI —
 * e.g. don't render the "More starting points" fallback until suggestions have
 * finished (`ready` or `error`), so users see the AI's tailored picks first
 * without the static list competing for attention.
 */
export type IntentSuggestionsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseIntentSuggestionsResult {
  /**
   * Suggestions the LLM produced, in the order returned, each already paired with
   * the pivot dimension it applies to. Empty when idle or on failure. Preserved
   * for callers that want the flat list; the grouped variant lives on
   * `categories`.
   */
  selections: IntentSelection[];
  /**
   * The same suggestions grouped into LLM-generated semantic categories (e.g.
   * "Apps & services", "Business KPIs"). Empty when the LLM returned no valid
   * categories — callers should fall back to a static category set in that case.
   */
  categories: GeneratedCategoryGroup[];
  /** True while a generation is in flight. */
  isLoading: boolean;
  /** Non-null when the last generation failed — the modal can hide the section silently. */
  error: Error | null;
  /** Coarse-grained status the UI can key off of without deriving it from three flags. */
  status: IntentSuggestionsStatus;
  /** Ask the Assistant to generate suggestions across the datasource's dimensions. */
  request: (args: RequestArgs) => void;
  /** Cancel any in-flight generation (e.g. on unmount or step change). */
  cancel: () => void;
}

/**
 * React hook that asks Grafana Assistant to propose dashboard "shapes" tailored to
 * the user's actual data. Uses `useInlineAssistant`, so nothing about the sidebar UI
 * is touched — the LLM call runs headlessly and streams into a hidden inline chat.
 *
 * Design notes:
 * - The system prompt asks for strict JSON output; we parse defensively and drop
 *   any element that doesn't fit `DashboardIntent`.
 * - The icon is constrained to {@link ALLOWED_ICONS}; anything else falls back to
 *   `ai-sparkle` so we never render an invalid Grafana icon.
 * - Failure is silent by design. The wizard already ships a rich static set of
 *   intents; the LLM suggestions are additive, so we never want to block the user
 *   on a failed generation.
 */
export function useIntentSuggestions(): UseIntentSuggestionsResult {
  const [selections, setSelections] = useState<IntentSelection[]>([]);
  const [categories, setCategories] = useState<GeneratedCategoryGroup[]>([]);
  const [error, setError] = useState<Error | null>(null);
  // Tracks whether we've fully completed at least one request (success or error)
  // *since the current `request()` was fired*. Used to distinguish "haven't asked
  // yet" from "asked and got an empty list".
  const [hasCompleted, setHasCompleted] = useState(false);
  const { generate, isGenerating, cancel } = useInlineAssistant();
  // Track the latest request so a late-arriving response from a previous request
  // can't overwrite state we've already cleared (e.g. after the user went "back").
  const requestIdRef = useRef(0);

  const request = useCallback(
    (args: RequestArgs) => {
      const requestId = ++requestIdRef.current;
      setSelections([]);
      setCategories([]);
      setError(null);
      setHasCompleted(false);

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(args);

      generate({
        origin: 'grafana/generate-dashboard-wizard/intent-suggestions',
        agentName: 'generate-dashboard-intents',
        systemPrompt,
        prompt: userPrompt,
        onComplete: (text) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          try {
            const parsed = parseSuggestionsFromLlmText(text);
            const resolvedIntents = parsed.intents
              .map((intent) => ({ intent, selection: resolveSelection(intent, args.analysis) }))
              .filter((entry): entry is { intent: SuggestedIntent; selection: IntentSelection } =>
                Boolean(entry.selection)
              );

            const resolvedCategories = groupSuggestionsByCategory(parsed.categories, resolvedIntents);
            const orderedSelections = resolvedIntents.map((entry) => entry.selection);
            setCategories(resolvedCategories);
            setSelections(orderedSelections);
          } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
          setHasCompleted(true);
        },
        onError: (err) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setError(err);
          setHasCompleted(true);
        },
      });
    },
    [generate]
  );

  useEffect(() => {
    return () => {
      // Bumping the ref invalidates any in-flight response so a late callback can't
      // overwrite state after unmount. The lint rule is designed to catch stale
      // DOM-node refs; ours is a monotonic counter where every increment is safe.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestIdRef.current++;
      cancel();
    };
  }, [cancel]);

  const status: IntentSuggestionsStatus = isGenerating ? 'loading' : error ? 'error' : hasCompleted ? 'ready' : 'idle';

  return { selections, categories, isLoading: isGenerating, error, status, request, cancel };
}

/**
 * Resolves a parsed suggestion's `labelKey` to a concrete {@link ExplorationOption}:
 * - Prefer an existing exploration option (matching either its primary key or one of
 *   its merged equivalents) so the suggestion inherits the wizard's sample values.
 * - Otherwise, if the LLM picked a real discovered label key, synthesise an option
 *   for it so the pivot still works.
 * - As a last resort fall back to the top-ranked option so a suggestion is never
 *   left danging without a dimension.
 */
function resolveSelection(intent: SuggestedIntent, analysis: DatasourceAnalysis): IntentSelection | null {
  const { labelKey, ...rest } = intent;
  const option = resolveOption(labelKey, analysis);
  if (!option) {
    return null;
  }
  return { intent: rest, option };
}

function resolveOption(labelKey: string | undefined, analysis: DatasourceAnalysis): ExplorationOption | undefined {
  if (labelKey) {
    const existing = analysis.options.find(
      (o) => o.labelKey === labelKey || (o.mergedLabelKeys ?? []).includes(labelKey)
    );
    if (existing) {
      return existing;
    }
    // The LLM referenced a real label key that didn't win a top-level option slot —
    // build a lightweight option for it so the pivot is still honoured.
    if (analysis.labelKeys.includes(labelKey) || analysis.labelSamples[labelKey]) {
      return {
        id: labelKey,
        labelKey,
        title: titleForLabelKey(labelKey),
        description: descriptionForLabelKey(labelKey),
        sampleValues: analysis.labelSamples[labelKey],
      };
    }
  }
  // Fall back to the top-ranked option so a suggestion is never left without a pivot.
  return analysis.options[0];
}

function buildSystemPrompt(): string {
  const iconList = ALLOWED_ICONS.join(', ');
  const categoryIconList = ALLOWED_CATEGORY_ICONS.join(', ');
  return [
    'You design the entry screen of a "Generate a dashboard" wizard for the selected datasource. You produce two things: a small set of semantic CATEGORIES the user picks from, and a broader set of dashboard-shape INTENTS distributed across those categories.',
    '',
    'You will get context about the selected datasource: what we DETECTED on it (`capabilities` — databases, runtimes, service mesh, cloud, Kubernetes, metric conventions, log signals), the dimensions the user can pivot on (`available_dimensions`), the metric namespaces present (`metric_families` as `prefix* (count)`), a representative `sample_metrics` list, and, when the store is Loki-shaped, `log_fields` (parsers + detected fields). You will also get a `user_context` block with `mode` (beginner|expert), `orientation` (technical|business|both), and `refinement` (free-form text describing what the user wants). Ground every category and every intent in the real data — never suggest something the data does not support.',
    '',
    'Design rules:',
    '- Categories describe SUBJECTS the datasource can meaningfully cover (e.g. "Apps & services", "Databases", "Kubernetes", "Business KPIs", "Errors & reliability"). They are NOT raw label dimensions. Pick titles a user would recognise at a glance.',
    '- Only include a category if you can populate it with at least ONE intent grounded in the data. Skip categories that would be padding.',
    '- When `user_context.orientation` is `business` or `both`, include a category with business-oriented intents (revenue, signups, conversion, orders, activation) IF the data supports it (look for `metric_families` like `orders_`, `payments_`, `signups_`, `revenue_`, `checkout_`, business labels, KPIs, or Loki fields like `order_id`, `payment_status`, `checkout_step`, `signup_source`).',
    '- Bias intents by `user_context.mode`: `beginner` → 6–10 broad "starting point" shapes across 3–5 categories; `expert` → 10–14 sharper, deeper shapes across up to 6 categories.',
    '- If `user_context.refinement` is non-empty, USE IT to prioritise which categories and intents to propose. Treat it as authoritative — suggest what the user asked for and drop unrelated shapes.',
    '- For Loki-like datasources, prefer intents that use logs (log volume by service, error rate from logs, level breakdown, top offenders, latency-from-logs) and reference detected fields where useful.',
    '- Spread intents across the dimensions the datasource actually supports; do NOT pin every intent to the same pivot label.',
    '- Do NOT invent metric names. Reference the families in `metric_families` and real names from `sample_metrics`. Skip a shape when nothing in `capabilities`, `metric_families`, `sample_metrics` or `log_fields` supports it.',
    "- Do not repeat shapes listed under 'existing_titles'.",
    '',
    `Return ONLY a JSON object (no prose, no markdown fences) with exactly two top-level fields, in this order:`,
    '',
    '  "categories": Category[]              // 3–6 categories.',
    '  "intents": Intent[]                   // 6–14 intents.',
    '',
    'Category = {',
    '  "id": string,                          // kebab-case, unique, starts with a letter.',
    '  "title": string,                       // 1–3 words shown as the group header.',
    '  "description": string?,                // Optional 1-sentence hint (kept short — displayed muted).',
    `  "iconHint": string                     // Exactly one of: ${categoryIconList}.`,
    '}',
    '',
    'Intent = {',
    '  "id": string,                          // kebab-case, unique within `intents`.',
    '  "categoryId": string,                  // MUST match a `categories[].id`.',
    '  "title": string,                       // 2–5 word title shown on the card.',
    '  "description": string,                 // 1–2 sentences the user reads.',
    '  "guidance": string,                    // 2–4 sentences telling the dashboard-building LLM which panels to build.',
    `  "iconHint": string,                    // Exactly one of: ${iconList}.`,
    '  "labelKey": string                     // Must be one of `available_dimensions[].labelKey`.',
    '}',
    '',
    `Cap: at most ${MAX_CATEGORIES} categories and ${MAX_SUGGESTIONS} intents. Reply with the JSON object only.`,
  ].join('\n');
}

/** Compact, non-empty-only capability summary for the suggestion prompt. */
function summariseCapabilitiesForIntents(analysis: DatasourceAnalysis): Record<string, unknown> {
  const caps = analysis.capabilities;
  const out: Record<string, unknown> = {};
  if (caps.metricConventions.length) {
    out.metric_conventions = caps.metricConventions;
  }
  if (caps.databases.length) {
    out.databases = caps.databases;
  }
  if (caps.clouds.length) {
    out.clouds = caps.clouds;
  }
  if (caps.serviceMesh.length) {
    out.service_mesh = caps.serviceMesh;
  }
  if (caps.runtimes.length) {
    out.runtimes = caps.runtimes;
  }
  if (caps.kubernetes.detected) {
    out.kubernetes = true;
  }
  if (caps.isLokiLike) {
    out.is_logs_store = true;
  }
  return out;
}

/** Summarises Loki log signals for the suggestion prompt. Empty when not Loki. */
function summariseLogSignals(analysis: DatasourceAnalysis): Record<string, unknown> | undefined {
  const logs = analysis.capabilities.logs;
  if (!analysis.capabilities.isLokiLike || logs.detectedFields.length === 0) {
    return undefined;
  }
  return {
    parsers: {
      json: logs.hasJSON,
      logfmt: logs.hasLogfmt,
    },
    has_level: logs.hasLevel,
    level_values: logs.levelValues,
    detected_fields: logs.detectedFields.slice(0, MAX_DETECTED_LOG_FIELDS_IN_PROMPT).map((f) => ({
      name: f.name,
      type: f.type,
      cardinality: f.cardinality,
      parsers: f.parsers,
    })),
  };
}

function buildUserPrompt({ primaryDatasource, analysis, existingTitles, context }: RequestArgs): string {
  const labelKeys = analysis.labelKeys.slice(0, MAX_LABEL_KEYS_IN_PROMPT);
  const labelSamples: Record<string, string[]> = {};
  for (const key of labelKeys) {
    const values = analysis.labelSamples[key];
    if (values?.length) {
      labelSamples[key] = values.slice(0, MAX_SAMPLE_VALUES_IN_PROMPT);
    }
  }

  const availableDimensions = analysis.options.slice(0, MAX_DIMENSIONS_IN_PROMPT).map((option) => ({
    labelKey: option.labelKey,
    title: option.title,
    sample_values: (option.sampleValues ?? []).slice(0, MAX_SAMPLE_VALUES_IN_PROMPT),
    equivalent_keys: option.mergedLabelKeys ?? [],
  }));

  const caps = analysis.capabilities;
  const capabilitySummary = summariseCapabilitiesForIntents(analysis);
  const metricFamilies = caps.metricFamilies
    .slice(0, MAX_METRIC_FAMILIES_IN_PROMPT)
    .map((family) => `${family.prefix}* (${family.count})`);
  const sampleMetrics = caps.sampledMetricNames.slice(0, MAX_SAMPLE_METRICS_IN_PROMPT);
  const logFields = summariseLogSignals(analysis);

  const payload = {
    datasource: {
      name: primaryDatasource.name,
      type: primaryDatasource.type,
      shape: caps.isLokiLike ? 'logs' : caps.isPrometheusLike ? 'metrics' : 'other',
    },
    user_context: {
      mode: context.mode,
      orientation: context.orientation,
      refinement: context.refinement.trim() || undefined,
    },
    capabilities: capabilitySummary,
    available_dimensions: availableDimensions,
    label_keys_discovered: labelKeys,
    label_samples: labelSamples,
    metric_families: metricFamilies,
    sample_metrics: sampleMetrics,
    log_fields: logFields,
    existing_titles: existingTitles,
  };

  const modeHint =
    context.mode === 'beginner'
      ? 'Beginner mode: prioritise a small set of high-signal starting points across 3–5 clearly-named categories.'
      : 'Expert mode: cover the full analytical surface — up to 6 categories, up to 14 sharper intents, including advanced views.';
  const orientationHint =
    context.orientation === 'business'
      ? 'Focus on business outcomes (revenue, signups, conversion, orders, activation). Only include technical categories when necessary for context.'
      : context.orientation === 'both'
        ? 'Mix technical and business-oriented shapes. Include at least one business category when the data supports it.'
        : 'Technical focus (SRE / SDE). Prioritise RED/USE, saturation, latency, error budgets, runtime.';
  const refinementHint = context.refinement.trim()
    ? `The user described what they want in the following words — treat them as authoritative: ${JSON.stringify(context.refinement.trim())}.`
    : 'No specific refinement from the user — cover the datasource broadly.';

  return [
    'Context (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    modeHint,
    orientationHint,
    refinementHint,
    '',
    'Return the JSON object as instructed (categories first, then intents referencing category ids).',
  ].join('\n');
}

/** Combined output of the LLM parser — categories AND intents. */
interface ParsedSuggestions {
  categories: SuggestedCategory[];
  intents: SuggestedIntent[];
}

/**
 * Extracts the LLM's `{ categories, intents }` object and validates each element
 * against the expected shapes. Defensive against common LLM misbehaviours:
 * markdown code fences, prose before/after, missing fields, wrong types. Falls
 * back to an intent-only response when the model returned just the array (older
 * prompt behaviour), so an in-flight downgrade still surfaces something.
 */
export function parseSuggestionsFromLlmText(raw: string): ParsedSuggestions {
  const trimmed = raw.trim();

  // Preferred shape: an object with `categories` + `intents`.
  const objectText = extractJsonObject(trimmed);
  if (objectText) {
    try {
      const parsed: unknown = JSON.parse(objectText);
      if (isPlainObject(parsed)) {
        const categoriesRaw = Array.isArray(parsed.categories) ? parsed.categories : [];
        const intentsRaw = Array.isArray(parsed.intents) ? parsed.intents : [];
        const categories = validateCategories(categoriesRaw);
        const intents = validateIntents(intentsRaw);
        return { categories, intents };
      }
    } catch {
      // fall through to the array shape.
    }
  }

  // Backwards-compat: a bare intent array with no categories.
  const arrayText = extractJsonArray(trimmed);
  if (arrayText) {
    try {
      const parsed: unknown = JSON.parse(arrayText);
      if (Array.isArray(parsed)) {
        return { categories: [], intents: validateIntents(parsed) };
      }
    } catch {
      // fall through — nothing recoverable.
    }
  }

  return { categories: [], intents: [] };
}

function validateCategories(items: unknown[]): SuggestedCategory[] {
  const seen = new Set<string>();
  const out: SuggestedCategory[] = [];
  for (const item of items) {
    const category = toCategory(item, seen);
    if (category) {
      out.push(category);
      seen.add(category.id);
    }
    if (out.length >= MAX_CATEGORIES) {
      break;
    }
  }
  return out;
}

function validateIntents(items: unknown[]): SuggestedIntent[] {
  const seen = new Set<string>();
  const out: SuggestedIntent[] = [];
  for (const item of items) {
    const intent = toIntent(item, seen);
    if (intent) {
      out.push(intent);
      seen.add(intent.id);
    }
    if (out.length >= MAX_SUGGESTIONS) {
      break;
    }
  }
  return out;
}

function extractJsonObject(raw: string): string | null {
  if (raw.startsWith('{')) {
    return raw;
  }
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('{')) {
      return inner;
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return null;
}

function extractJsonArray(raw: string): string | null {
  if (raw.startsWith('[')) {
    return raw;
  }
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('[')) {
      return inner;
    }
  }
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return null;
}

function toCategory(item: unknown, seenIds: Set<string>): SuggestedCategory | null {
  if (!isPlainObject(item)) {
    return null;
  }
  const id = normaliseId(typeof item.id === 'string' ? item.id : '');
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const description = typeof item.description === 'string' ? item.description.trim() : undefined;
  const rawIcon = typeof item.iconHint === 'string' ? item.iconHint : '';
  if (!id || !title || seenIds.has(id)) {
    return null;
  }
  const icon = isAllowedCategoryIcon(rawIcon) ? rawIcon : FALLBACK_CATEGORY_ICON;
  return { id, title, description: description || undefined, icon };
}

function toIntent(item: unknown, seenIds: Set<string>): SuggestedIntent | null {
  if (!isPlainObject(item)) {
    return null;
  }
  const rawId = typeof item.id === 'string' ? item.id : '';
  const rawTitle = typeof item.title === 'string' ? item.title : '';
  const rawDescription = typeof item.description === 'string' ? item.description : '';
  const rawGuidance = typeof item.guidance === 'string' ? item.guidance : '';
  const rawIconHint = typeof item.iconHint === 'string' ? item.iconHint : '';
  const rawLabelKey = typeof item.labelKey === 'string' ? item.labelKey.trim() : '';
  const rawCategory = typeof item.categoryId === 'string' ? item.categoryId.trim() : '';

  const id = normaliseId(rawId);
  const title = rawTitle.trim();
  const description = rawDescription.trim();
  const guidance = rawGuidance.trim();

  if (!id || !title || !description || !guidance) {
    return null;
  }
  if (seenIds.has(id)) {
    return null;
  }

  const icon = isAllowedIcon(rawIconHint) ? rawIconHint : FALLBACK_ICON;
  const categoryId = rawCategory ? normaliseId(rawCategory) || undefined : undefined;
  return {
    id,
    title,
    description,
    guidance,
    icon,
    labelKey: rawLabelKey || undefined,
    categoryId,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard confirming a raw string is one of {@link ALLOWED_ICONS}. Using a guard
 * rather than an `as IconName` cast keeps us safe against typos in the allow-list
 * and satisfies Grafana's lint rule against inline type assertions.
 */
function isAllowedIcon(value: string): value is IconName {
  for (const icon of ALLOWED_ICONS) {
    if (icon === value) {
      return true;
    }
  }
  return false;
}

function isAllowedCategoryIcon(value: string): value is IconName {
  for (const icon of ALLOWED_CATEGORY_ICONS) {
    if (icon === value) {
      return true;
    }
  }
  return false;
}

/**
 * Groups resolved suggestions into their LLM-declared categories, preserving
 * order. Any intent whose `categoryId` doesn't match a declared category is
 * dropped into a synthetic "More" bucket so a stray LLM omission never hides a
 * good suggestion. Categories with zero surviving intents are pruned.
 */
function groupSuggestionsByCategory(
  categories: SuggestedCategory[],
  resolved: Array<{ intent: SuggestedIntent; selection: IntentSelection }>
): GeneratedCategoryGroup[] {
  const byId = new Map<string, GeneratedCategoryGroup>();
  for (const category of categories) {
    byId.set(category.id, {
      id: category.id,
      title: category.title,
      description: category.description,
      icon: category.icon,
      selections: [],
    });
  }
  const fallback: GeneratedCategoryGroup = {
    id: 'more',
    title: t('dashboard-generate.categories.more', 'More starting points'),
    icon: FALLBACK_CATEGORY_ICON,
    selections: [],
  };

  for (const { intent, selection } of resolved) {
    const group = intent.categoryId ? byId.get(intent.categoryId) : undefined;
    if (group) {
      group.selections.push(selection);
    } else {
      fallback.selections.push(selection);
    }
  }

  const ordered: GeneratedCategoryGroup[] = [];
  for (const category of categories) {
    const group = byId.get(category.id);
    if (group && group.selections.length > 0) {
      ordered.push(group);
    }
  }
  if (fallback.selections.length > 0) {
    ordered.push(fallback);
  }
  return ordered;
}

/**
 * Sanitises the LLM's `id` field into a stable kebab-case identifier. We want IDs
 * to be safe for use as React keys and (potentially) as element IDs in the future.
 */
function normaliseId(raw: string): string {
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!clean || !/^[a-z]/.test(clean)) {
    return '';
  }
  return clean.length > 60 ? clean.slice(0, 60) : clean;
}
