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
  name: string;
  count: number;
}

export interface AnnotationTagList {
  items: AnnotationTagItem[];
}
