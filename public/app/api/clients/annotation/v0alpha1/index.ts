import { type AnnotationEvent } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyCreatedBy } from 'app/features/apiserver/types';

import {
  ANNOTATION_API_GROUP,
  ANNOTATION_API_VERSION,
  type Annotation,
  type AnnotationForCreate,
  type AnnotationList,
  type AnnotationSpec,
  type AnnotationTagItem,
  type AnnotationTagList,
} from './types';

const ANNOTATIONS_RESOURCE = 'annotations';
const TAGS_RESOURCE = 'tags';
const SEARCH_RESOURCE = 'search';

let cachedClient: ScopedResourceClient<AnnotationSpec, object, 'Annotation'> | null = null;

/**
 * Returns the underlying generic k8s resource client. Lazily constructed so that
 * tests / config changes that mutate `config.namespace` are picked up.
 */
function getResourceClient(): ScopedResourceClient<AnnotationSpec, object, 'Annotation'> {
  if (!cachedClient) {
    cachedClient = new ScopedResourceClient<AnnotationSpec, object, 'Annotation'>({
      group: ANNOTATION_API_GROUP,
      version: ANNOTATION_API_VERSION,
      resource: ANNOTATIONS_RESOURCE,
    });
  }
  return cachedClient;
}

/** @internal exposed for tests so a fresh client is built against the current config. */
export function resetAnnotationK8sClientForTests() {
  cachedClient = null;
}

/** Build the spec portion of an annotation k8s object from a legacy AnnotationEvent + scope names. */
export function annotationEventToSpec(event: AnnotationEvent, scopes?: string[]): AnnotationSpec {
  const isRegion = event.isRegion ?? (event.timeEnd !== undefined && event.timeEnd !== event.time);

  const spec: AnnotationSpec = {
    text: event.text ?? '',
    time: event.time ?? 0,
  };

  if (isRegion && event.timeEnd !== undefined && event.timeEnd !== event.time) {
    spec.timeEnd = event.timeEnd;
  }

  if (event.dashboardUID) {
    spec.dashboardUID = event.dashboardUID;
  }

  if (typeof event.panelId === 'number') {
    spec.panelID = event.panelId;
  }

  if (event.tags && event.tags.length > 0) {
    spec.tags = event.tags;
  }

  if (scopes && scopes.length > 0) {
    spec.scopes = scopes;
  }

  return spec;
}

// Legacy query responses return numeric IDs (number or string, e.g. 23 or "23");
// the k8s backend requires the "a-{id}" prefix. Already-prefixed names pass through.
function toK8sName(id: string | number): string {
  const s = String(id);
  return s.startsWith('a-') ? s : `a-${s}`;
}

// Inverse of toK8sName: strip the "a-" prefix from the resource name so callers
// see the same id shape the legacy /api/annotations response used.
function nameToLegacyId(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  return name.startsWith('a-') ? name.slice(2) : name;
}

/** AnnotationEvent extended with the raw `createdBy` identity ref ("user:<uid>") so
 * callers can hydrate identity fields (login/email/avatarUrl) via the IAM display
 * endpoint without losing access to the legacy-shaped event. */
export type AnnotationEventResource = AnnotationEvent & { createdBy?: string };

/** Build the `AnnotationEvent`-shaped object that callers of the legacy
 * /api/annotations response expect, from a k8s Annotation resource. */
export function annotationToEvent(anno: Annotation): AnnotationEventResource {
  const { spec, metadata } = anno;
  const event: AnnotationEventResource = {
    id: nameToLegacyId(metadata.name),
    time: spec.time,
    text: spec.text,
  };
  if (spec.timeEnd != null) {
    event.timeEnd = spec.timeEnd;
  }
  if (spec.tags && spec.tags.length > 0) {
    event.tags = spec.tags;
  }
  if (spec.dashboardUID) {
    event.dashboardUID = spec.dashboardUID;
  }
  if (typeof spec.panelID === 'number') {
    event.panelId = spec.panelID;
  }
  const createdBy = metadata.annotations?.[AnnoKeyCreatedBy];
  if (createdBy) {
    event.createdBy = createdBy;
  }
  return event;
}

// Translate legacy-shaped params (matchAny, panelId, tags) to the names expected
// by /search (tagsMatchAny, panelID, tag). Accepts a loose record because the
// AnnotationServer.query interface is loosely typed; recognized keys
// (see AnnotationSearchParams) are validated by type.
function toSearchQueryParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof params.from === 'number') {
    out.from = params.from;
  }
  if (typeof params.to === 'number') {
    out.to = params.to;
  }
  if (typeof params.limit === 'number') {
    out.limit = params.limit;
  }
  if (typeof params.continue === 'string' && params.continue) {
    out.continue = params.continue;
  }
  if (typeof params.dashboardUID === 'string' && params.dashboardUID) {
    out.dashboardUID = params.dashboardUID;
  }
  if (typeof params.panelId === 'number') {
    out.panelID = params.panelId;
  }
  if (Array.isArray(params.tags) && params.tags.length > 0) {
    out.tag = params.tags;
  }
  if (typeof params.matchAny === 'boolean') {
    out.tagsMatchAny = params.matchAny;
  }
  if (Array.isArray(params.scopes) && params.scopes.length > 0) {
    out.scope = params.scopes;
  }
  if (typeof params.scopesMatchAny === 'boolean') {
    out.scopesMatchAny = params.scopesMatchAny;
  }
  if (typeof params.createdBy === 'string' && params.createdBy) {
    out.createdBy = params.createdBy;
  }
  return out;
}

/** Build the wire payload for a POST (create) request. */
export function buildCreatePayload(event: AnnotationEvent, scopes?: string[]): AnnotationForCreate {
  return {
    apiVersion: `${ANNOTATION_API_GROUP}/${ANNOTATION_API_VERSION}`,
    kind: 'Annotation',
    metadata: {},
    spec: annotationEventToSpec(event, scopes),
  };
}

export const annotationK8sClient = {
  create(event: AnnotationEvent, scopes?: string[]): Promise<Annotation> {
    return getResourceClient().create(buildCreatePayload(event, scopes));
  },

  // Fetch-then-merge: k8s PUT requires the current resourceVersion for optimistic concurrency.
  async update(event: AnnotationEvent, scopes?: string[]): Promise<Annotation> {
    if (!event.id) {
      throw new Error('Annotation id (metadata.name) is required for update');
    }

    const client = getResourceClient();
    const existing = await client.get(toK8sName(event.id));
    const nextSpec = annotationEventToSpec(event, scopes);

    // Explicit assignment ensures undefined fields (timeEnd, scopes) from nextSpec
    // overwrite any existing values — `...nextSpec` alone wouldn't remove them.
    const merged: Annotation = {
      ...existing,
      spec: { ...existing.spec, ...nextSpec, timeEnd: nextSpec.timeEnd, scopes: nextSpec.scopes },
    };

    return client.update(merged);
  },

  remove(name: string | number): Promise<unknown> {
    return getResourceClient().delete(toK8sName(name), false);
  },

  async tags(limit = 1000): Promise<AnnotationTagItem[]> {
    const url = `/apis/${ANNOTATION_API_GROUP}/${ANNOTATION_API_VERSION}/namespaces/${getAPINamespace()}/${TAGS_RESOURCE}`;
    const response = await getBackendSrv().get<AnnotationTagList>(url, { limit });
    return response.tags ?? [];
  },

  async search(params: Record<string, unknown>, requestId?: string): Promise<AnnotationEventResource[]> {
    const url = `/apis/${ANNOTATION_API_GROUP}/${ANNOTATION_API_VERSION}/namespaces/${getAPINamespace()}/${SEARCH_RESOURCE}`;
    const response = await getBackendSrv().get<AnnotationList>(url, toSearchQueryParams(params), requestId);
    return (response.items ?? []).map(annotationToEvent);
  },
};
