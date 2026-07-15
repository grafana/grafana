import { useCallback, useMemo, useRef } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { getDataSourceSrv } from '@grafana/runtime';

import { buildRefinementPrompt, WIZARD_ORIGIN, type WizardRevision } from './prompts';
import { buildWizardTools, fetchMetricLabels, fetchMetricNames, lookupLabelValues } from './tools';
import {
  type WizardDatasource,
  type WizardFinding,
  type WizardMetricRef,
  type WizardQuestion,
  type WizardRefinement,
  type WizardSummary,
  type WizardSummaryPanel,
  type WizardSummarySection,
  type WizardVerifiedMetric,
} from './types';

/** Datasources the wizard grounds its suggestions and queries in. */
export function getWizardDatasources(): WizardDatasource[] {
  return getDataSourceSrv()
    .getList()
    .map((ds) => ({ uid: ds.uid, type: ds.type, name: ds.name }));
}

/**
 * Extracts the JSON object from an LLM response, tolerating markdown fences
 * and surrounding prose.
 */
function parseWizardJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('The assistant returned an unexpected response. Please try again.');
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The assistant returned an unexpected response. Please try again.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeQuestions(raw: unknown): WizardQuestion[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const questions: WizardQuestion[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const { id, text, options, allowMultiple } = entry;
    if (typeof text !== 'string' || text === '' || !Array.isArray(options)) {
      continue;
    }
    const answerOptions = options.filter((option): option is string => typeof option === 'string' && option !== '');
    if (answerOptions.length < 2) {
      continue;
    }
    questions.push({
      id: typeof id === 'string' && id !== '' ? id : text,
      text,
      options: answerOptions,
      allowMultiple: allowMultiple === true,
    });
  }
  return questions;
}

function normalizeSummarySections(raw: unknown): WizardSummarySection[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sections: WizardSummarySection[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.title !== 'string' || entry.title.trim() === '') {
      continue;
    }
    const panels: WizardSummaryPanel[] = [];
    if (Array.isArray(entry.panels)) {
      for (const panel of entry.panels) {
        if (!isRecord(panel) || typeof panel.title !== 'string' || panel.title.trim() === '') {
          continue;
        }
        panels.push({
          title: panel.title.trim(),
          visualization: typeof panel.visualization === 'string' ? panel.visualization.trim() : '',
        });
      }
    }
    sections.push({ title: entry.title.trim(), panels });
  }
  return sections;
}

function normalizeMetrics(raw: unknown): WizardMetricRef[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const refs: WizardMetricRef[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.datasourceUid !== 'string' || entry.datasourceUid.trim() === '') {
      continue;
    }
    const names = Array.isArray(entry.names)
      ? entry.names
          .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
          .map((n) => n.trim())
      : [];
    if (names.length === 0) {
      continue;
    }
    refs.push({ datasourceUid: entry.datasourceUid.trim(), names });
  }
  return refs;
}

/**
 * Checks the metrics a plan relies on against the datasources they belong to,
 * returning the ones that do not exist. Datasources we can't verify (wrong
 * type, lookup failed) are skipped — we only block on confirmed-missing
 * metrics, never on an inability to check.
 */
async function findMissingMetrics(metrics: WizardMetricRef[], datasources: WizardDatasource[]): Promise<string[]> {
  const byUid = new Map(datasources.map((ds) => [ds.uid, ds]));
  const missing: string[] = [];
  for (const ref of metrics) {
    const ds = byUid.get(ref.datasourceUid);
    if (!ds) {
      continue;
    }
    const available = await fetchMetricNames(ds);
    if (!available) {
      continue;
    }
    for (const name of ref.names) {
      if (!available.has(name)) {
        missing.push(name);
      }
    }
  }
  return Array.from(new Set(missing));
}

/** Bounds the per-metric label lookups so a large plan can't fan out unboundedly. */
const MAX_LABEL_LOOKUPS = 24;

/**
 * For each confirmed metric, looks up the labels it actually carries so the
 * build only filters and builds variables from labels that exist on that
 * metric — datasource-wide labels (e.g. cluster) do not imply a metric has
 * them. `labels` is left undefined when the lookup can't run.
 */
async function verifyMetricLabels(
  metrics: WizardMetricRef[],
  datasources: WizardDatasource[]
): Promise<WizardVerifiedMetric[]> {
  const byUid = new Map(datasources.map((ds) => [ds.uid, ds]));
  const verified: WizardVerifiedMetric[] = [];
  let lookups = 0;
  for (const ref of metrics) {
    const ds = byUid.get(ref.datasourceUid);
    for (const name of ref.names) {
      let labels: string[] | undefined;
      if (ds && lookups < MAX_LABEL_LOOKUPS) {
        lookups++;
        labels = (await fetchMetricLabels(ds, name)) ?? undefined;
      }
      verified.push({ datasourceUid: ref.datasourceUid, name, labels });
    }
  }
  return verified;
}

/**
 * Validates the assistant's plain-language plan. Returns undefined when the
 * model omitted it or returned something unusable, so the summary step can
 * fall back to the raw build prompt rather than render an empty card.
 */
function normalizeSummary(raw: unknown): WizardSummary | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const { title, description, layout, sections } = raw;
  if (typeof title !== 'string' || title.trim() === '') {
    return undefined;
  }
  return {
    title: title.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    layout: typeof layout === 'string' && layout.trim() !== '' ? layout.trim() : undefined,
    sections: normalizeSummarySections(sections),
  };
}

export interface WizardAssistant {
  /**
   * Reorganizes the user's free-form request into a precise build request,
   * grounded in verified data, with clarifying questions when genuinely
   * needed. `contextNotes` carries the serialized context items the user
   * attached through the context picker.
   */
  refine: (
    request: string,
    datasources: WizardDatasource[],
    contextNotes?: string,
    /** Present when the user asked to change the plan on the review step. */
    revision?: WizardRevision
  ) => Promise<WizardRefinement>;
  /** Everything the wizard verified to exist so far (deduped, latest wins). */
  getFindings: () => WizardFinding[];
  /**
   * Fire-and-forget lookup of label values directly against the datasources'
   * label APIs (no LLM involved), recorded as findings. Used to warm the data
   * the build agent will want (e.g. template-variable values) while the user
   * is still in the wizard. Deduped against previous lookups.
   */
  prefetchLabelValues: (datasources: WizardDatasource[], labels: string[]) => void;
}

/**
 * Headless assistant calls backing the wizard. The refine call runs an inline
 * (chat-less) assistant generation grounded through the wizard tools, and
 * parses the structured JSON out of the response. Data discovered along the
 * way is accumulated and exposed via getFindings so the final generation
 * prompt can hand it to the building agent.
 */
export function useWizardAssistant(): WizardAssistant {
  const { generate } = useInlineAssistant();

  // Findings from all lookups, keyed by lookup, so repeats don't stack.
  const findings = useRef(new Map<string, WizardFinding>());
  // Lookups already fired speculatively, so repeated prefetches are free.
  const prefetchedLookups = useRef(new Set<string>());

  const recordFinding = useCallback((finding: WizardFinding) => {
    const key = `${finding.datasourceUid}|${finding.label}|${finding.contains ?? ''}`;
    findings.current.set(key, finding);
  }, []);

  const prefetchLabelValues = useCallback(
    (datasources: WizardDatasource[], labels: string[]) => {
      for (const ds of datasources) {
        for (const label of labels) {
          const key = `${ds.uid}|${label}|`;
          if (findings.current.has(key) || prefetchedLookups.current.has(key)) {
            continue;
          }
          prefetchedLookups.current.add(key);
          lookupLabelValues(ds, label)
            .then((finding) => {
              // Empty results are not worth replaying to the build agent.
              if (finding && finding.values.length > 0) {
                recordFinding(finding);
              }
            })
            .catch(() => prefetchedLookups.current.delete(key));
        }
      }
    },
    [recordFinding]
  );

  const run = useCallback(
    (agentName: string, systemPrompt: string, prompt: string, datasources: WizardDatasource[]): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        generate({
          origin: WIZARD_ORIGIN,
          agentName,
          prompt,
          systemPrompt,
          tools: buildWizardTools(datasources, recordFinding),
          onComplete: resolve,
          onError: reject,
        });
      });
    },
    [generate, recordFinding]
  );

  return useMemo(() => {
    const runRefine = async (
      request: string,
      datasources: WizardDatasource[],
      contextNotes: string | undefined,
      revision: WizardRevision | undefined,
      unavailableMetrics: string[] | undefined
    ): Promise<WizardRefinement> => {
      const { systemPrompt, prompt } = buildRefinementPrompt(
        request,
        datasources,
        contextNotes,
        revision,
        unavailableMetrics
      );
      const parsed = parseWizardJson(await run('wizard-refine', systemPrompt, prompt, datasources));
      const refined = typeof parsed.prompt === 'string' && parsed.prompt.trim() !== '' ? parsed.prompt : request;
      const dataNotes = typeof parsed.dataNotes === 'string' && parsed.dataNotes !== '' ? parsed.dataNotes : undefined;
      return {
        prompt: refined,
        summary: normalizeSummary(parsed.summary),
        dataNotes,
        metrics: normalizeMetrics(parsed.metrics),
        questions: normalizeQuestions(parsed.questions),
      };
    };

    return {
      refine: async (request, datasources, contextNotes, revision) => {
        // Verify the metrics the plan relies on actually exist before the user
        // sees it; hallucinated metrics are the main cause of empty panels. If
        // any are missing, run one corrective round with the confirmed-missing
        // list so the model rebuilds around real data.
        let result = await runRefine(request, datasources, contextNotes, revision, undefined);
        let missing = await findMissingMetrics(result.metrics ?? [], datasources);
        if (missing.length > 0) {
          result = await runRefine(request, datasources, contextNotes, revision, missing);
          missing = await findMissingMetrics(result.metrics ?? [], datasources);
        }

        // Whatever is still unconfirmed must never reach the builder as a
        // "verified metric" — drop it so the build prompt only asserts metrics
        // we actually checked.
        if (missing.length > 0 && result.metrics) {
          const unavailable = new Set(missing);
          result = {
            ...result,
            metrics: result.metrics
              .map((ref) => ({ ...ref, names: ref.names.filter((name) => !unavailable.has(name)) }))
              .filter((ref) => ref.names.length > 0),
          };
        }

        // Resolve the real label set of each confirmed metric so the build only
        // filters and builds variables from labels that metric actually has.
        result = { ...result, verifiedMetrics: await verifyMetricLabels(result.metrics ?? [], datasources) };
        return result;
      },

      getFindings: () => Array.from(findings.current.values()),

      prefetchLabelValues,
    };
  }, [run, prefetchLabelValues]);
}
