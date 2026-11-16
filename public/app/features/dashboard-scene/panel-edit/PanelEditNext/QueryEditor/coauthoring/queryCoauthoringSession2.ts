import { cloneDeep } from 'lodash';

import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { type QueryCoauthoringSessionEngine } from './QueryCoauthoringSessionEngine';
import { resolveCoauthoringQuery } from './queryCoauthoringContext';
import {
  type QueryCoauthoringContextResult,
  type QueryCoauthoringEntryBaseline,
  type QueryCoauthoringSession,
  type QueryCoauthoringSession2,
  type QueryCoauthoringState2,
} from './queryCoauthoringContracts';
import { expressionReferences } from './queryCoauthoringDependencies';
import { deriveQueryHealth } from './queryCoauthoringHealth';
import { classifyQueryResult } from './queryCoauthoringPreviewOutcome';

export function createCoauthoringSession2({
  handle,
  entry,
  panel,
  runner,
  owner,
  stage,
}: {
  handle: QueryCoauthoringSession;
  entry: QueryCoauthoringEntryBaseline;
  panel: VizPanel;
  runner: SceneQueryRunner;
  owner: QueryCoauthoringSessionEngine;
  stage: QueryCoauthoringSession2['stageProposal'];
}): QueryCoauthoringSession2 {
  const baseline = cloneDeep(entry);
  const dependencies = () =>
    Object.fromEntries(
      runner.state.queries.map((query) => [
        query.refId,
        [
          ...new Set(expressionReferences({ ...query, datasource: query.datasource ?? runner.state.datasource })),
        ].filter((id) => runner.state.queries.some((query) => query.refId === id)),
      ])
    );
  const getState = (): QueryCoauthoringState2 => {
    const state = handle.getState();
    const data = owner.getCanonicalData();
    const errors = [...(data?.errors ?? []), ...(data?.error ? [data.error] : [])];
    const unscoped = errors.filter((error) => !error.refId);
    const scopedData = data && { ...data, error: undefined, errors: errors.filter((error) => error.refId) };
    const health = deriveQueryHealth(state.queries, scopedData);
    const problems: QueryCoauthoringState2['problems'] = unscoped.map((error) => ({
      scope: 'panel',
      kind: 'error',
      message: error.message?.slice(0, 500),
    }));
    for (const query of state.queries) {
      if (unscoped.length && health[query.refId] === 'no-data') {
        health[query.refId] = 'unknown';
      }
      const kind = health[query.refId];
      if (kind === 'error' || kind === 'no-data') {
        const outcome = classifyQueryResult(scopedData, query.refId);
        problems.push({
          scope: 'query',
          refId: query.refId,
          kind,
          ...(outcome.kind === 'error' ? { message: outcome.message } : {}),
        });
      }
    }
    return {
      ...state,
      health,
      contextGeneration: owner.getContextGeneration(),
      dependencies: dependencies(),
      problems,
    };
  };
  return {
    ...handle,
    version: 2,
    getState,
    subscribe: (listener) => handle.subscribe(() => listener(getState())),
    stageProposal: stage,
    async getContext({ baseRevision, signal }): Promise<QueryCoauthoringContextResult> {
      const revision = owner.getRevision();
      const contextGeneration = owner.getContextGeneration();
      const stale = (): QueryCoauthoringContextResult => ({
        status: 'stale',
        currentRevision: owner.getRevision(),
        currentContextGeneration: owner.getContextGeneration(),
      });
      if (handle.signal.aborted) {
        return { status: 'closed' };
      }
      if (signal?.aborted) {
        return { status: 'aborted' };
      }
      if (baseRevision !== revision) {
        return stale();
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      handle.signal.addEventListener('abort', abort, { once: true });
      const queries = cloneDeep(runner.state.queries);
      const datasource = cloneDeep(runner.state.datasource);
      const deps = dependencies();
      const contexts = [];
      const validators: Array<{ refId: string; current(): Promise<boolean> }> = [];
      try {
        for (const query of queries) {
          if (handle.signal.aborted) {
            return { status: 'closed' };
          }
          if (signal?.aborted) {
            return { status: 'aborted' };
          }
          if (revision !== owner.getRevision() || contextGeneration !== owner.getContextGeneration()) {
            return stale();
          }
          const resolved = await resolveCoauthoringQuery(panel, query, datasource, controller.signal);

          if (handle.signal.aborted) {
            return { status: 'closed' };
          }
          if (signal?.aborted) {
            return { status: 'aborted' };
          }
          owner.observeResolver(query.refId, resolved.identity);
          try {
            const current = await resolved.current();
            if (handle.signal.aborted) {
              return { status: 'closed' };
            }
            if (signal?.aborted) {
              return { status: 'aborted' };
            }
            if (!current) {
              owner.invalidateContext();
              return stale();
            }
          } catch {
            contexts.push({
              refId: query.refId,
              dependencies: deps[query.refId],
              editability: resolved.editability,
              description: { status: 'failed' as const, reason: 'datasource_resolution_failed' as const },
            });
            continue;
          }
          validators.push({ refId: query.refId, current: resolved.current });
          contexts.push({
            refId: query.refId,
            dependencies: deps[query.refId],
            editability: resolved.editability,
            description: resolved.description,
          });
        }
        for (const validator of validators) {
          try {
            const current = await validator.current();
            if (handle.signal.aborted) {
              return { status: 'closed' };
            }
            if (signal?.aborted) {
              return { status: 'aborted' };
            }
            if (!current) {
              owner.invalidateContext();
              return stale();
            }
          } catch {
            const context = contexts.find((context) => context.refId === validator.refId)!;
            context.description = { status: 'failed', reason: 'datasource_resolution_failed' };
          }
        }
        if (handle.signal.aborted) {
          return { status: 'closed' };
        }
        if (signal?.aborted) {
          return { status: 'aborted' };
        }
        if (revision !== owner.getRevision() || contextGeneration !== owner.getContextGeneration()) {
          return stale();
        }
        const focus = contexts.find((query) => query.refId === baseline.refId)?.description;
        return {
          status: 'ready',
          sessionId: handle.getState().sessionId,
          revision,
          contextGeneration,
          queries: contexts,
          entry: {
            ...cloneDeep(baseline),
            matchesCurrentText:
              baseline.status === 'ready' && focus?.status === 'ready' ? baseline.text === focus.value.text : 'unknown',
          },
        };
      } finally {
        signal?.removeEventListener('abort', abort);
        handle.signal.removeEventListener('abort', abort);
      }
    },
  };
}
