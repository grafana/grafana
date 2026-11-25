import { cloneDeep, isEqual, pick } from 'lodash';

import { type DataQuery, type ScopedVars } from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings, logError } from '@grafana/runtime';
import { sceneGraph, type SceneObject, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { getPanelScopedVars } from '../utils';

import {
  isQueryCoauthoringLanguage,
  type DataSourceWithQueryCoauthoring,
  type QueryCoauthoringDescriptionResult,
  type QueryCoauthoringEditability,
  type QueryCoauthoringLanguage,
  type QueryCoauthoringLanguageDescription,
} from './queryCoauthoringContracts';

export function reportCoauthoringError(error: unknown, signal: AbortSignal, phase: string) {
  if (signal.aborted || (record(error) && error.name === 'AbortError')) {
    return;
  }
  logError(error instanceof Error ? error : new Error('Query coauthoring failed'), {
    component: 'query-coauthoring',
    phase,
  });
}

// Exclude live Scene references and transient UI state from resolver identity.
const RESOLVER_VARIABLE_STATE_FIELDS = [
  'name',
  'type',
  'value',
  'text',
  'query',
  'datasource',
  'filters',
  'baseFilters',
  'includeAll',
  'allValue',
  'isMulti',
  'groupByKeys',
];

export function resolverInputs(panel: VizPanel, runner: SceneQueryRunner) {
  const variables: unknown[] = [];
  for (let object: SceneObject | undefined = panel; object; object = object.parent) {
    variables.push(
      object.state.$variables?.state.variables.map((variable) => pick(variable.state, RESOLVER_VARIABLE_STATE_FIELDS))
    );
  }
  return cloneDeep({
    rawFrom: sceneGraph.getTimeRange(panel).state.from,
    rawTo: sceneGraph.getTimeRange(panel).state.to,
    datasource: runner.state.datasource,
    variables,
  });
}

export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCoauthoringDescription(value: unknown): value is QueryCoauthoringLanguageDescription {
  return (
    record(value) &&
    typeof value.text === 'string' &&
    record(value.language) &&
    typeof value.language.id === 'string' &&
    typeof value.language.displayName === 'string' &&
    (value.language.guidance === undefined ||
      (Array.isArray(value.language.guidance) && value.language.guidance.every((item) => typeof item === 'string'))) &&
    (value.metadata === undefined ||
      (Array.isArray(value.metadata) &&
        value.metadata.every(
          (item) =>
            record(item) &&
            typeof item.kind === 'string' &&
            typeof item.name === 'string' &&
            (item.attributes === undefined ||
              (record(item.attributes) &&
                Object.values(item.attributes).every(
                  (value) =>
                    typeof value === 'string' ||
                    (Array.isArray(value) && value.every((part) => typeof part === 'string'))
                )))
        )))
  );
}

export interface CoauthoringResolverIdentity {
  datasource: object | undefined;
  factory: unknown;
  configuration: unknown;
  support: QueryCoauthoringEditability;
}

export interface ResolvedCoauthoringQuery {
  identity?: CoauthoringResolverIdentity;
  editability: QueryCoauthoringEditability;
  description: QueryCoauthoringDescriptionResult;
  language?: QueryCoauthoringLanguage;
  current(): Promise<boolean>;
}

export async function resolveCoauthoringQuery(
  panel: VizPanel,
  query: DataQuery,
  fallback: SceneQueryRunner['state']['datasource'],
  signal: AbortSignal,
  describe = true
): Promise<ResolvedCoauthoringQuery> {
  let datasource: DataSourceWithQueryCoauthoring | undefined;
  let factory: unknown;
  let configuration: unknown;
  const outcome = (
    editability: QueryCoauthoringEditability,
    description: QueryCoauthoringDescriptionResult,
    language?: QueryCoauthoringLanguage
  ): ResolvedCoauthoringQuery => {
    const identity = { datasource, factory, configuration, support: editability };
    return {
      identity,
      editability,
      description,
      language,
      current: async () => {
        const latest = await resolveCoauthoringQuery(panel, query, fallback, signal, false);
        return sameResolverIdentity(identity, latest.identity);
      },
    };
  };
  const failed = (reason: 'datasource_resolution_failed' | 'language_resolution_failed') =>
    outcome({ kind: 'unknown', reason }, { status: 'failed', reason });
  if (signal.aborted) {
    return failed('datasource_resolution_failed');
  }
  const scopedVars: ScopedVars = getPanelScopedVars(panel);
  try {
    const settings = await untilAborted(
      getDataSourceInstanceSettings(query.datasource ?? fallback, scopedVars),
      signal
    );
    datasource = await untilAborted(getDataSourceInstance(query.datasource ?? fallback, scopedVars), signal);
    configuration = cloneDeep({
      settings,
      instance: 'instanceSettings' in datasource ? datasource.instanceSettings : undefined,
    });
  } catch (error) {
    reportCoauthoringError(error, signal, 'datasource_resolution');
    return failed('datasource_resolution_failed');
  }
  let candidate: unknown;
  try {
    factory = datasource.queryCoauthoring;
    if (factory !== undefined && typeof factory !== 'function') {
      return failed('language_resolution_failed');
    }
    candidate = typeof factory === 'function' ? factory.call(datasource) : undefined;
    if (candidate == null || (record(candidate) && typeof candidate.version === 'number' && candidate.version !== 1)) {
      const reason = candidate == null ? 'missing_language' : 'unsupported_language_version';
      return outcome({ kind: 'unsupported', reason }, { status: 'unavailable', reason });
    }
    if (!isQueryCoauthoringLanguage(candidate)) {
      return failed('language_resolution_failed');
    }
  } catch (error) {
    reportCoauthoringError(error, signal, 'language_resolution');
    return failed('language_resolution_failed');
  }
  const language = candidate;
  const editability = readSupport(candidate, query, signal);
  let description: QueryCoauthoringDescriptionResult = { status: 'failed', reason: 'description_failed' };
  if (describe) {
    try {
      const value: unknown = await untilAborted(language.describe(cloneDeep(query), { signal }), signal);
      if (isCoauthoringDescription(value)) {
        description = { status: 'ready', value: cloneDeep(value) };
      }
    } catch (error) {
      reportCoauthoringError(error, signal, 'description');
    }
  }
  return outcome(editability, description, language);
}

export function sameResolverIdentity(
  a: CoauthoringResolverIdentity | undefined,
  b: CoauthoringResolverIdentity | undefined
): boolean {
  return (
    a?.datasource === b?.datasource &&
    a?.factory === b?.factory &&
    isEqual(a?.configuration, b?.configuration) &&
    isEqual(a?.support, b?.support)
  );
}

function readSupport(candidate: unknown, query: DataQuery, signal: AbortSignal): QueryCoauthoringEditability {
  try {
    if (!record(candidate)) {
      return { kind: 'unknown', reason: 'support_check_failed' };
    }
    const hook = candidate.getQuerySupport;
    if (hook === undefined) {
      return { kind: 'unknown', reason: 'missing_query_support' };
    }
    if (typeof hook !== 'function') {
      return { kind: 'unknown', reason: 'support_check_failed' };
    }
    const support: unknown = hook.call(candidate, cloneDeep(query));
    if (!record(support) || typeof support.editable !== 'boolean') {
      return { kind: 'unknown', reason: 'support_check_failed' };
    }
    return { kind: support.editable ? 'editable' : 'read_only' };
  } catch (error) {
    reportCoauthoringError(error, signal, 'support_check');
    return { kind: 'unknown', reason: 'support_check_failed' };
  }
}
