import {
  PanelKind,
  QueryGroupKind,
  VizConfigKind,
  PanelQueryKind,
  TransformationKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPanelQueryKind(value: unknown): value is PanelQueryKind {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind !== 'PanelQuery' || !isObject(value.spec)) {
    return false;
  }
  // Minimal checks for query spec; accept additional properties
  if (typeof value.spec.refId !== 'string') {
    return false;
  }
  if (typeof value.spec.hidden !== 'boolean') {
    return false;
  }
  // value.spec.query is an opaque "DataQueryKind" which is { kind: string, spec: Record<string, any> }
  const q = value.spec.query;
  if (!isObject(q) || typeof q.kind !== 'string' || !isObject(q.spec)) {
    return false;
  }
  return true;
}

function isTransformationKind(value: unknown): value is TransformationKind {
  if (!isObject(value)) {
    return false;
  }
  if (typeof value.kind !== 'string') {
    return false;
  }
  if (!isObject(value.spec)) {
    return false;
  }
  return true;
}

function isQueryGroupKind(value: unknown): value is QueryGroupKind {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind !== 'QueryGroup' || !isObject(value.spec)) {
    return false;
  }
  const spec = value.spec;
  if (!Array.isArray(spec.queries) || !spec.queries.every(isPanelQueryKind)) {
    return false;
  }
  if (!Array.isArray(spec.transformations) || !spec.transformations.every(isTransformationKind)) {
    return false;
  }
  if (!isObject(spec.queryOptions)) {
    return false;
  }
  return true;
}

function isVizConfigKind(value: unknown): value is VizConfigKind {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind !== 'VizConfig') {
    return false;
  }
  if (typeof value.group !== 'string') {
    return false;
  }
  if (typeof value.version !== 'string') {
    return false;
  }
  if (!isObject(value.spec)) {
    return false;
  }
  const spec = value.spec;
  if (!isObject(spec.options)) {
    return false;
  }
  if (!isObject(spec.fieldConfig)) {
    return false;
  }
  // Minimal fieldConfig shape (defaults/overrides may be empty)
  if (!isObject(spec.fieldConfig)) {
    return false;
  }
  return true;
}

export function isPanelKindV2(value: unknown): value is PanelKind {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind !== 'Panel') {
    return false;
  }
  if (!isObject(value.spec)) {
    return false;
  }
  const spec = value.spec;
  if (typeof spec.id !== 'number') {
    return false;
  }
  if (typeof spec.title !== 'string') {
    return false;
  }
  if (typeof spec.description !== 'string') {
    return false;
  }
  if (!Array.isArray(spec.links)) {
    return false;
  }
  if (!isQueryGroupKind(spec.data)) {
    return false;
  }
  if (!isVizConfigKind(spec.vizConfig)) {
    return false;
  }
  if (spec.transparent !== undefined && typeof spec.transparent !== 'boolean') {
    return false;
  }
  return true;
}

export function validatePanelKindV2(value: unknown): asserts value is PanelKind {
  if (!isPanelKindV2(value)) {
    throw new Error('Provided JSON is not a valid v2 Panel spec');
  }
}
