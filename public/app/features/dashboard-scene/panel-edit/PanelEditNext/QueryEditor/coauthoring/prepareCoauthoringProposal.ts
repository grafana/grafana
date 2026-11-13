import { cloneDeep, isEqual } from 'lodash';

import { type DataQuery } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { getPanelScopedVars } from '../utils';

import { type CoauthoringRunOption } from './QueryCoauthoringRuns';
import {
  type DataSourceWithQueryCoauthoring,
  isQueryCoauthoringLanguage,
  type QueryCoauthoringDiff,
  type QueryCoauthoringOption,
  type QueryCoauthoringRange,
  type QueryCoauthoringStageResult,
} from './queryCoauthoringContracts';
import { queryCoauthoringDiff } from './queryCoauthoringDiff';

interface ProposalPreparation {
  panel: VizPanel;
  baseline: DataQuery[];
  datasource: SceneQueryRunner['state']['datasource'];
  focus: string;
  ranges: QueryCoauthoringRange[];
  proposal: QueryCoauthoringOption[];
  signal: AbortSignal;
  nextId: () => string;
}

export async function prepareCoauthoringProposal({
  panel,
  baseline,
  datasource,
  focus,
  ranges,
  proposal,
  signal,
  nextId,
}: ProposalPreparation): Promise<{ options: CoauthoringRunOption[]; results: QueryCoauthoringStageResult[] }> {
  const staged: CoauthoringRunOption[] = [];
  const results: QueryCoauthoringStageResult[] = [];
  for (const option of proposal) {
    if (!option || !Array.isArray(option.changes)) {
      results.push({ status: 'invalid' });
      continue;
    }
    const queries = cloneDeep(baseline);
    const diffs: QueryCoauthoringDiff[] = [];
    let rejected: 'invalid' | 'unsupported' | undefined;
    const seen = new Set<string>();
    for (const change of option.changes) {
      const index = baseline.findIndex((query) => query.refId === change?.refId);
      if (!change || index < 0 || seen.has(change.refId) || typeof change.text !== 'string') {
        rejected = 'invalid';
        break;
      }
      seen.add(change.refId);
      try {
        const ds: DataSourceWithQueryCoauthoring = await untilAborted(
          getDataSourceInstance(baseline[index].datasource ?? datasource, getPanelScopedVars(panel)),
          signal
        );
        const language = ds.queryCoauthoring?.();
        if (!isQueryCoauthoringLanguage(language)) {
          rejected = 'unsupported';
          break;
        }
        const description = await untilAborted(
          language.describe(cloneDeep(baseline[index]), { signal: signal }),
          signal
        );
        const prepared = language.prepare(cloneDeep(baseline[index]), change.text);
        if (prepared.status === 'rejected') {
          if (prepared.reason === 'invalid') {
            rejected = 'invalid';
            break;
          }
          continue;
        }
        if (prepared.query.refId !== change.refId || !isEqual(prepared.query.datasource, baseline[index].datasource)) {
          rejected = 'invalid';
          break;
        }
        if (isEqual(prepared.query, baseline[index])) {
          continue;
        }
        queries[index] = cloneDeep(prepared.query);
        const focusRanges =
          change.refId === focus ? (ranges.length ? ranges : [{ from: 0, to: description.text.length }]) : [];
        const hunks = queryCoauthoringDiff(description.text, change.text, focusRanges, true);
        let offset = 0;
        const proposedRanges = hunks.map((hunk) => {
          const from = hunk.from + offset;
          offset += hunk.proposed.length - hunk.original.length;
          return { from, to: from + hunk.proposed.length };
        });
        diffs.push({
          refId: change.refId,
          original: description.text,
          proposed: change.text,
          originalRanges: hunks.length
            ? hunks.map(({ from, to }) => ({ from, to }))
            : [{ from: 0, to: description.text.length }],
          proposedRanges: hunks.length ? proposedRanges : [{ from: 0, to: change.text.length }],
          editsOutsideFocus:
            change.refId !== focus || (ranges.length > 0 && hunks.some((hunk) => hunk.focus === 'outside')),
        });
      } catch {
        rejected = 'unsupported';
        break;
      }
    }
    if (rejected) {
      results.push({ status: rejected });
    } else if (!diffs.length || staged.some((candidate) => isEqual(candidate.queries, queries))) {
      results.push({ status: 'unchanged' });
    } else {
      const id = nextId();
      staged.push({ id, queries });
      results.push({ status: 'staged', id, diffs });
    }
  }
  return { options: staged, results };
}

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  let abort: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  return Promise.race([promise, cancelled]).finally(() => signal.removeEventListener('abort', abort));
}
