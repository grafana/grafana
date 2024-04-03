/**
 * This file holds generic kubernetes compatible types.
 *
 * This is very much a work in progress aiming to simplify common access patterns for k8s resource
 * Please update and improve types/utilities while we find a good pattern here!
 *
 * Once this is more stable and represents a more general pattern, it should be moved to @grafana/data
 *
 */

/** The object type and version */
export interface TypeMeta<K = string> {
  apiVersion: string;
  kind: K;
}

export interface ObjectMeta {
  // Name is the unique identifier in k8s -- it maps to the "uid" value in most existing grafana objects
  name: string;
  // Namespace maps the owner group -- it is typically the org or stackId for most grafana resources
  namespace?: string;
  // Resource version will increase (not sequentially!) with any change to the saved value
  resourceVersion: string;
  // The first time this was saved
  creationTimestamp: string;
  // General resource annotations -- including the common grafana.app values
  annotations?: GrafanaAnnotations;
  // General application level key+value pairs
  labels?: Record<string, string>;
}

export const AnnoKeyCreatedBy = 'grafana.app/createdBy';
export const AnnoKeyUpdatedTimestamp = 'grafana.app/updatedTimestamp';
export const AnnoKeyUpdatedBy = 'grafana.app/updatedBy';
export const AnnoKeyFolder = 'grafana.app/folder';
export const AnnoKeySlug = 'grafana.app/slug';

// Identify where values came from
const AnnoKeyOriginName = 'grafana.app/originName';
const AnnoKeyOriginPath = 'grafana.app/originPath';
const AnnoKeyOriginKey = 'grafana.app/originKey';
const AnnoKeyOriginTimestamp = 'grafana.app/originTimestamp';

type GrafanaAnnotations = {
  [AnnoKeyCreatedBy]?: string;
  [AnnoKeyUpdatedTimestamp]?: string;
  [AnnoKeyUpdatedBy]?: string;
  [AnnoKeyFolder]?: string;
  [AnnoKeySlug]?: string;

  [AnnoKeyOriginName]?: string;
  [AnnoKeyOriginPath]?: string;
  [AnnoKeyOriginKey]?: string;
  [AnnoKeyOriginTimestamp]?: string;

  // Any key value
  [key: string]: string | undefined;
};

export interface Resource<T = object, K = string> extends TypeMeta<K> {
  metadata: ObjectMeta;
  spec: T;
}

export interface ResourceForCreate<T = object, K = string> extends Partial<TypeMeta<K>> {
  metadata: Partial<ObjectMeta>;
  spec: T;
}

export interface ListMeta {
  resourceVersion: string;
  continue?: string;
  remainingItemCount?: number;
}

export interface ResourceList<T, K = string> extends TypeMeta {
  metadata: ListMeta;
  items: Array<Resource<T, K>>;
}

export type ListOptionsLabelSelector<T = {}> =
  | string
  | Array<
      | {
          key: keyof T;
          operator: '=' | '!=';
          value: string;
        }
      | {
          key: keyof T;
          operator: 'in' | 'notin';
          value: string[];
        }
      | {
          key: keyof T;
          operator: '' | '!';
        }
    >;

export interface ListOptions<T = {}> {
  // continue the list at a given batch
  continue?: string;

  // Query by labels
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
  labelSelector?: ListOptionsLabelSelector<T>;

  // Limit the response count
  limit?: number;
}

export interface MetaStatus {
  // Status of the operation. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
  status: 'Success' | 'Failure';

  // A human-readable description of the status of this operation.
  message: string;

  // Suggested HTTP return code for this status, 0 if not set.
  code: number;

  // A machine-readable description of why this operation is in the "Failure" status.
  reason?: string;

  // Extended data associated with the reason
  details?: object;
}

export interface ResourceServer<T = object, K = string> {
  create(obj: ResourceForCreate<T, K>): Promise<void>;
  get(name: string): Promise<Resource<T, K>>;
  list(opts?: ListOptions<T>): Promise<ResourceList<T, K>>;
  update(obj: ResourceForCreate<T, K>): Promise<Resource<T, K>>;
  delete(name: string): Promise<MetaStatus>;
}
