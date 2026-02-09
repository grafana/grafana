import { AnnotationEvent } from '@grafana/data';

import { AnnotationResource, AnnotationResourceForCreate } from './k8sAnnotationClient';

// Converts K8s annotation resource to legacy AnnotationEvent format
export function k8sToLegacyAnnotation(resource: AnnotationResource): AnnotationEvent {
  // extract numeric ID from name (format: "a-123")
  const id = resource.metadata.name.startsWith('a-') ? resource.metadata.name.substring(2) : resource.metadata.name;

  return {
    id,
    text: resource.spec.text,
    time: resource.spec.time,
    timeEnd: resource.spec.timeEnd,
    dashboardUID: resource.spec.dashboardUID || null,
    panelId: resource.spec.panelID,
    tags: resource.spec.tags || [],
  };
}

// Converts legacy AnnotationEvent to K8s annotation resource format
export function legacyToK8sAnnotation(event: AnnotationEvent): AnnotationResourceForCreate {
  const metadata: AnnotationResourceForCreate['metadata'] = {};

  // if updating existing annotation, set the name (format: "a-{id}")
  if (event.id) {
    metadata.name = `a-${event.id}`;
  }

  return {
    metadata,
    spec: {
      text: event.text || '',
      time: event.time || Date.now(),
      timeEnd: event.timeEnd,
      dashboardUID: event.dashboardUID || undefined,
      panelID: event.panelId,
      tags: event.tags || [],
    },
  };
}
