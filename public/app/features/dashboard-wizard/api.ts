import { useCallback, useMemo, useRef } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { getDataSourceSrv } from '@grafana/runtime';

import { buildRefinementPrompt, WIZARD_ORIGIN } from './prompts';
import { buildWizardTools, lookupLabelValues } from './tools';
import { type WizardDatasource, type WizardFinding, type WizardQuestion, type WizardRefinement } from './types';

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

export interface WizardAssistant {
  /**
   * Reorganizes the user's free-form request into a precise build request,
   * grounded in verified data, with clarifying questions when genuinely
   * needed. `contextNotes` carries the serialized context items the user
   * attached through the context picker.
   */
  refine: (request: string, datasources: WizardDatasource[], contextNotes?: string) => Promise<WizardRefinement>;
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

  return useMemo(
    () => ({
      refine: async (request, datasources, contextNotes) => {
        const { systemPrompt, prompt } = buildRefinementPrompt(request, datasources, contextNotes);
        const parsed = parseWizardJson(await run('wizard-refine', systemPrompt, prompt, datasources));
        const refined = typeof parsed.prompt === 'string' && parsed.prompt.trim() !== '' ? parsed.prompt : request;
        const dataNotes =
          typeof parsed.dataNotes === 'string' && parsed.dataNotes !== '' ? parsed.dataNotes : undefined;
        return { prompt: refined, dataNotes, questions: normalizeQuestions(parsed.questions) };
      },

      getFindings: () => Array.from(findings.current.values()),

      prefetchLabelValues,
    }),
    [run, prefetchLabelValues]
  );
}
