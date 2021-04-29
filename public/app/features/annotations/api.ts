import { AnnotationEvent } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

export function saveAnnotation(annotation: AnnotationEvent) {
  return getBackendSrv().post('/api/annotations', annotation);
}

export function updateAnnotation(annotation: AnnotationEvent) {
  return getBackendSrv().put(`/api/annotations/${annotation.id}`, annotation);
}

export function deleteAnnotation(annotation: AnnotationEvent) {
  return getBackendSrv().delete(`/api/annotations/${annotation.id}`);
}
