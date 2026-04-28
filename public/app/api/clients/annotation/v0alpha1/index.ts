import { type AnnotationEvent } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { ScopedResourceClient } from 'app/features/apiserver/client';

import {
  ANNOTATION_API_GROUP,
  ANNOTATION_API_VERSION,
  type Annotation,
  type AnnotationForCreate,
  type AnnotationSpec,
  type AnnotationTagItem,
  type AnnotationTagList,
} from './types';

const ANNOTATIONS_RESOURCE = 'annotations';
const TAGS_RESOURCE = 'tags';

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

  /**
   * Fetches the existing annotation, merges the supplied event/scopes onto its spec,
   * and PUTs the result back. Fetch-then-merge is required because k8s updates need the
   * current `metadata.resourceVersion` for optimistic concurrency.
   */
  async update(event: AnnotationEvent, scopes?: string[]): Promise<Annotation> {
    if (!event.id) {
      throw new Error('Annotation id (metadata.name) is required for update');
    }

    const client = getResourceClient();
    const existing = await client.get(event.id);
    const nextSpec = annotationEventToSpec(event, scopes);

    const merged: Annotation = {
      ...existing,
      spec: {
        ...existing.spec,
        ...nextSpec,
        // timeEnd should track the new event semantics: if it's no longer a region the
        // mapper omits it from `nextSpec`, so we must clear it explicitly here.
        timeEnd: nextSpec.timeEnd,
        // Same for scopes: if the caller passes [] we drop them, otherwise carry through.
        scopes: nextSpec.scopes,
      },
    };

    return client.update(merged);
  },

  remove(name: string): Promise<unknown> {
    return getResourceClient().delete(name, false);
  },

  async tags(limit = 1000): Promise<AnnotationTagItem[]> {
    const url = `/apis/${ANNOTATION_API_GROUP}/${ANNOTATION_API_VERSION}/namespaces/${getAPINamespace()}/${TAGS_RESOURCE}`;
    const response = await getBackendSrv().get<AnnotationTagList>(url, { limit });
    return response.items ?? [];
  },
};
