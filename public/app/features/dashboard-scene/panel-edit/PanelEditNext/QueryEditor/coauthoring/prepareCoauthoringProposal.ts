import { cloneDeep, isEqual } from 'lodash';

import { type DataQuery } from '@grafana/data';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { type CoauthoringRunOption } from './QueryCoauthoringRuns';
import {
  type CoauthoringResolverIdentity,
  resolveCoauthoringQuery,
  untilAborted,
  isCoauthoringDescription,
} from './queryCoauthoringContext';
import {
  type QueryCoauthoringDiff,
  type QueryCoauthoringEntryBaseline,
  type QueryCoauthoringOption,
  type QueryCoauthoringStageResult,
} from './queryCoauthoringContracts';
import { queryCoauthoringDiff } from './queryCoauthoringDiff';

export async function prepareCoauthoringProposal({
  panel,
  baseline,
  datasource,
  focus,
  entry,
  proposal,
  signal,
  nextId,
  isCurrent,
  invalidateContext,
  observeResolver,
}: {
  panel: VizPanel;
  baseline: DataQuery[];
  datasource: SceneQueryRunner['state']['datasource'];
  focus: string;
  entry: QueryCoauthoringEntryBaseline;
  proposal: QueryCoauthoringOption[];
  signal: AbortSignal;
  nextId(): string;
  isCurrent(): boolean;
  invalidateContext(): void;
  observeResolver(refId: string, identity?: CoauthoringResolverIdentity): void;
}): Promise<{ options: CoauthoringRunOption[]; results: QueryCoauthoringStageResult[] }> {
  let options: CoauthoringRunOption[] = [];
  const validators: Array<{ index: number; refId: string; current(): Promise<boolean> }> = [];
  const results: QueryCoauthoringStageResult[] = [];
  for (const option of proposal) {
    if (!option || !Array.isArray(option.changes)) {
      results.push({ status: 'invalid', issue: { kind: 'invalid_change' } });
      continue;
    }
    const queries = cloneDeep(baseline);
    const diffs: QueryCoauthoringDiff[] = [];
    let rejection: QueryCoauthoringStageResult | undefined;
    const seen = new Set<string>();
    for (const change of option.changes) {
      const refId = typeof change?.refId === 'string' ? change.refId : undefined;
      const index = baseline.findIndex((query) => query.refId === refId);
      if (!refId || index < 0 || seen.has(refId) || typeof change.text !== 'string') {
        rejection = { status: 'invalid', issue: { kind: 'invalid_change', ...(refId ? { refId } : {}) } };
        break;
      }
      seen.add(refId);
      const resolved = await resolveCoauthoringQuery(panel, baseline[index], datasource, signal, false);
      observeResolver(refId, resolved.identity);
      if (!isCurrent()) {
        rejection = { status: 'stale' };
        break;
      }
      validators.push({ index: results.length, refId, current: resolved.current });
      const support = resolved.editability;
      if (support.kind === 'unsupported') {
        rejection = { status: 'unsupported', issue: { kind: support.reason, refId } };
        break;
      }
      if (support.kind === 'read_only') {
        rejection = { status: 'rejected', issue: { kind: 'read_only', refId } };
        break;
      }
      if (support.kind === 'unknown') {
        rejection =
          support.reason === 'missing_query_support'
            ? { status: 'rejected', issue: { kind: 'unknown_editability', refId } }
            : { status: 'failed', issue: { kind: support.reason, refId } };
        break;
      }
      const language = resolved.language!;
      let description: unknown;
      try {
        description = await untilAborted(language.describe(cloneDeep(baseline[index]), { signal }), signal);
      } catch {
        rejection = { status: 'failed', issue: { kind: 'description_failed', refId } };
        break;
      }
      if (!isCoauthoringDescription(description)) {
        rejection = { status: 'failed', issue: { kind: 'description_failed', refId } };
        break;
      }
      if (!isCurrent()) {
        rejection = { status: 'stale' };
        break;
      }
      if (refId === focus && entry.ranges.length) {
        if (entry.status === 'unavailable') {
          rejection = { status: 'unsupported', issue: { kind: entry.reason, refId } };
          break;
        }
        if (entry.status === 'failed') {
          rejection = { status: 'failed', issue: { kind: entry.reason, refId } };
          break;
        }
        if (entry.text !== description.text) {
          rejection = { status: 'rejected', issue: { kind: 'entry_ranges_changed', refId } };
          break;
        }
      }
      let prepared: unknown;
      try {
        prepared = language.prepare(cloneDeep(baseline[index]), change.text);
      } catch {
        rejection = { status: 'failed', issue: { kind: 'preparation_failed', refId } };
        break;
      }
      if (!prepared || typeof prepared !== 'object' || !('status' in prepared)) {
        rejection = { status: 'failed', issue: { kind: 'preparation_failed', refId } };
        break;
      }
      if (prepared.status === 'rejected' && 'reason' in prepared) {
        if (prepared.reason === 'unchanged') {
          continue;
        }
        if (prepared.reason === 'invalid') {
          rejection = { status: 'invalid', issue: { kind: 'invalid_text', refId } };
          break;
        }
      }
      if (
        prepared.status !== 'ready' ||
        !('query' in prepared) ||
        !isPreparedQuery(prepared.query) ||
        !('changes' in prepared) ||
        !Array.isArray(prepared.changes) ||
        !prepared.changes.every(
          (change) =>
            change &&
            typeof change === 'object' &&
            typeof change.original === 'string' &&
            typeof change.proposed === 'string' &&
            validRanges(change.originalRanges) &&
            validRanges(change.proposedRanges)
        )
      ) {
        rejection = { status: 'failed', issue: { kind: 'preparation_failed', refId } };
        break;
      }
      const query = prepared.query;
      if (query.refId !== refId || !isEqual(query.datasource, baseline[index].datasource)) {
        rejection = { status: 'failed', issue: { kind: 'preparation_failed', refId } };
        break;
      }
      try {
        if (!(await resolved.current())) {
          invalidateContext();
          rejection = { status: 'stale' };
          break;
        }
      } catch {
        rejection = { status: 'failed', issue: { kind: 'datasource_resolution_failed', refId } };
        break;
      }
      if (isEqual(query, baseline[index])) {
        continue;
      }
      queries[index] = cloneDeep(query);
      const ranges = refId === focus ? entry.ranges : [];
      const hunks = queryCoauthoringDiff(
        description.text,
        change.text,
        ranges.length ? ranges : [{ from: 0, to: description.text.length }],
        true
      );
      let offset = 0;
      const proposedRanges = hunks.map((hunk) => {
        const from = hunk.from + offset;
        offset += hunk.proposed.length - hunk.original.length;
        return { from, to: from + hunk.proposed.length };
      });
      diffs.push({
        refId,
        original: description.text,
        proposed: change.text,
        originalRanges: hunks.map(({ from, to }) => ({ from, to })),
        proposedRanges,
        editsOutsideFocus: refId !== focus || (ranges.length > 0 && hunks.some((hunk) => hunk.focus === 'outside')),
      });
    }
    if (rejection) {
      results.push(rejection);
    } else if (!diffs.length || options.some((option) => isEqual(option.queries, queries))) {
      results.push({ status: 'unchanged' });
    } else {
      const id = nextId();
      options.push({ id, queries });
      results.push({ status: 'staged', id, diffs });
    }
  }
  for (const validator of validators) {
    if (results[validator.index].status !== 'staged') {
      continue;
    }
    try {
      if (!(await validator.current())) {
        invalidateContext();
        return { options: [], results: proposal.map(() => ({ status: 'stale' })) };
      }
    } catch {
      const previous = results[validator.index];
      if (previous.status === 'staged') {
        options = options.filter((option) => option.id !== previous.id);
      }
      results[validator.index] = {
        status: 'failed',
        issue: { kind: 'datasource_resolution_failed', refId: validator.refId },
      };
    }
  }
  return { options, results };
}

function validRanges(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (range) =>
        range &&
        typeof range === 'object' &&
        Number.isInteger(range.from) &&
        Number.isInteger(range.to) &&
        range.from >= 0 &&
        range.to >= range.from
    )
  );
}

function isPreparedQuery(value: unknown): value is DataQuery {
  return (
    !!value && typeof value === 'object' && !Array.isArray(value) && 'refId' in value && typeof value.refId === 'string'
  );
}
