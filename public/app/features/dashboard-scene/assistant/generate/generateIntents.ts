import { useCallback, useEffect, useRef, useState } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { type IconName } from '@grafana/ui';

import { descriptionForLabelKey, titleForLabelKey } from './analysis';
import { type DashboardIntent, type DatasourceAnalysis, type ExplorationOption, type IntentSelection } from './types';

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
 * How many suggestions we ask the LLM for. A little larger than the per-dimension
 * era because a single datasource-wide pass now covers every pivot dimension at
 * once — we want a few tailored picks spread across the interesting dimensions.
 */
const MAX_SUGGESTIONS = 6;

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

interface RequestArgs {
  primaryDatasource: DataSourceInstanceSettings;
  analysis: DatasourceAnalysis;
  /** Titles of intents already shown to the user, so the LLM avoids duplicates. */
  existingTitles: string[];
}

/** A parsed suggestion before we resolve its `labelKey` to a concrete pivot dimension. */
interface SuggestedIntent extends DashboardIntent {
  /** The label key the LLM chose to pivot this shape on, if any. */
  labelKey?: string;
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
   * the pivot dimension it applies to. Empty when idle or on failure.
   */
  selections: IntentSelection[];
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
            const parsed = parseIntentsFromLlmText(text);
            const resolved = parsed
              .map((intent) => resolveSelection(intent, args.analysis))
              .filter((s): s is IntentSelection => s !== null);
            setSelections(resolved);
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

  return { selections, isLoading: isGenerating, error, status, request, cancel };
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
  return [
    'You suggest short "dashboard shapes" the user can generate for a Grafana dashboard.',
    '',
    'You will get context about the selected datasource: what we DETECTED on it (`capabilities` — databases, runtimes, service mesh, cloud, Kubernetes, metric conventions), the dimensions the user can pivot on (`available_dimensions`), a broader list of discovered labels, the metric namespaces present (`metric_families` as `prefix* (count)`), and a representative `sample_metrics` list of real metric names. Suggest distinct dashboard shapes tailored to THIS stack, complementing (never duplicating) the shapes the wizard already offers. Spread your suggestions across DIFFERENT dimensions when the data supports it — do not pin every suggestion to the same pivot.',
    '',
    `Return ONLY a JSON array of up to ${MAX_SUGGESTIONS} elements. No prose, no markdown code fences, no leading text. Each element must be an object with exactly these fields:`,
    '- id: kebab-case identifier starting with a letter, unique within the array',
    '- title: 2–5 word title shown on the row',
    '- description: one or two sentences the user reads',
    '- guidance: two to four sentences telling a dashboard-building LLM which panels to build. Ground it in the provided data — reference the metric families in `metric_families` and real names from `sample_metrics`, and prefer signals implied by `capabilities` (e.g. only suggest Postgres panels when `databases` includes postgres). Do NOT hard-code metric names that contradict the families shown.',
    `- iconHint: exactly one of: ${iconList}`,
    '- labelKey: the single dimension this shape pivots on. MUST be one of the `labelKey` values listed under `available_dimensions` in the prompt.',
    '',
    "Do not repeat any of the shapes listed under 'existing_titles' in the prompt. If the datasource does not have the signals a shape would need (nothing in `capabilities`, `metric_families` or `sample_metrics` supports it), do not suggest that shape.",
    '',
    'Reply with the JSON array only.',
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
  return out;
}

function buildUserPrompt({ primaryDatasource, analysis, existingTitles }: RequestArgs): string {
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

  const payload = {
    datasource: {
      name: primaryDatasource.name,
      type: primaryDatasource.type,
    },
    // What we detected on the datasource — suggestions should reflect this stack.
    capabilities: capabilitySummary,
    available_dimensions: availableDimensions,
    label_keys_discovered: labelKeys,
    label_samples: labelSamples,
    // Real metric namespaces + a representative sample so guidance stays grounded.
    metric_families: metricFamilies,
    sample_metrics: sampleMetrics,
    existing_titles: existingTitles,
  };

  return [
    'Context (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    `Suggest up to ${MAX_SUGGESTIONS} dashboard shapes for this data, spread across the available dimensions. Return the JSON array as instructed.`,
  ].join('\n');
}

/**
 * Extracts a JSON array from the LLM's raw text response, then validates each element
 * against the `DashboardIntent` shape. Defensive against common LLM misbehaviours:
 * markdown code fences, prose before/after, extra fields, missing fields, wrong types.
 */
export function parseIntentsFromLlmText(raw: string): SuggestedIntent[] {
  const jsonText = extractJsonArray(raw);
  if (!jsonText) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const seenIds = new Set<string>();
  const out: SuggestedIntent[] = [];
  for (const item of parsed) {
    const intent = toIntent(item, seenIds);
    if (intent) {
      out.push(intent);
      seenIds.add(intent.id);
    }
    if (out.length >= MAX_SUGGESTIONS) {
      break;
    }
  }
  return out;
}

function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return trimmed;
  }
  // Strip common markdown fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('[')) {
      return inner;
    }
  }
  // Fallback: find the first '[' and last ']' — brittle but handles prose wrapping.
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
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
  return { id, title, description, guidance, icon, labelKey: rawLabelKey || undefined };
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
