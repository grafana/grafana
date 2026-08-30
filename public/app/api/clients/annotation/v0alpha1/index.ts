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

function resourceClient(): ScopedResourceClient<AnnotationSpec, object, 'Annotation'> {
  return new ScopedResourceClient<AnnotationSpec, object, 'Annotation'>({
    group: ANNOTATION_API_GROUP,
    version: ANNOTATION_API_VERSION,
    resource: ANNOTATIONS_RESOURCE,
  });
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

// The legacy-sql store returns numeric IDs (e.g. 23) and the k8s adapter wraps
// them as `a-{id}` because metadata.name must start with a letter. Other store
// backends (memory, postgres) use string ids that are already valid k8s names,
// so the `a-` prefix only round-trips when the underlying id is numeric — for
// non-numeric ids, name and legacy id are the same string.
function toK8sName(id: string | number): string {
  const s = String(id);
  if (s.startsWith('a-')) {
    return s;
  }
  return /^\d+$/.test(s) ? `a-${s}` : s;
}

function nameToLegacyId(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  return /^a-\d+$/.test(name) ? name.slice(2) : name;
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
    return resourceClient().create(buildCreatePayload(event, scopes));
  },

  // JSON Merge Patch (RFC 7396) lets the server perform the read-modify-write
  // atomically — no need to fetch the existing resourceVersion first. Optional
  // fields (timeEnd, tags, scopes) are sent as explicit `null` when absent so
  // stale values are cleared; an omitted field would be a no-op under merge-patch.
  update(event: AnnotationEvent, scopes?: string[]): Promise<Annotation> {
    if (!event.id) {
      return Promise.reject(new Error('Annotation id (metadata.name) is required for update'));
    }

    const nextSpec = annotationEventToSpec(event, scopes);
    const patchSpec: Record<string, unknown> = {
      text: nextSpec.text,
      time: nextSpec.time,
      timeEnd: nextSpec.timeEnd ?? null,
      tags: nextSpec.tags ?? null,
      scopes: nextSpec.scopes ?? null,
    };
    if (nextSpec.dashboardUID !== undefined) {
      patchSpec.dashboardUID = nextSpec.dashboardUID;
    }
    if (nextSpec.panelID !== undefined) {
      patchSpec.panelID = nextSpec.panelID;
    }

    const url = `/apis/${ANNOTATION_API_GROUP}/${ANNOTATION_API_VERSION}/namespaces/${getAPINamespace()}/${ANNOTATIONS_RESOURCE}/${toK8sName(event.id)}`;
    return getBackendSrv().patch<Annotation>(
      url,
      { spec: patchSpec },
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
  },

  remove(name: string | number): Promise<unknown> {
    return resourceClient().delete(toK8sName(name), false);
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
