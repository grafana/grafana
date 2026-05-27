import { type Resource, type ResourceForCreate, type ResourceList } from 'app/features/apiserver/types';

export const ANNOTATION_API_GROUP = 'annotation.grafana.app';
export const ANNOTATION_API_VERSION = 'v0alpha1';

export interface AnnotationSpec {
  text: string;
  time: number;
  timeEnd?: number;
  dashboardUID?: string;
  panelID?: number;
  tags?: string[];
  scopes?: string[];
}

export type Annotation = Resource<AnnotationSpec, object, 'Annotation'>;
export type AnnotationForCreate = ResourceForCreate<AnnotationSpec, 'Annotation'>;
export type AnnotationList = ResourceList<AnnotationSpec, object, 'Annotation'>;

export interface AnnotationTagItem {
  tag: string;
  count: number;
}

export interface AnnotationTagList {
  tags?: AnnotationTagItem[];
}

// Mirrors the params accepted by the /search sub-resource (search_handler.go).
// dashboardId is intentionally absent — the new endpoint only supports dashboardUID.
export interface AnnotationSearchParams {
  from?: number;
  to?: number;
  limit?: number;
  continue?: string;
  dashboardUID?: string;
  panelId?: number;
  tags?: string[];
  matchAny?: boolean;
  scopes?: string[];
  scopesMatchAny?: boolean;
  createdBy?: string;
}
