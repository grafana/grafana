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
  annotations?: GrafanaAnnotations & GrafanaClientAnnotations;
  // General application level key+value pairs
  labels?: Record<string, string>;
}

export const AnnoKeyCreatedBy = 'grafana.app/createdBy';
export const AnnoKeyUpdatedTimestamp = 'grafana.app/updatedTimestamp';
export const AnnoKeyUpdatedBy = 'grafana.app/updatedBy';
export const AnnoKeyFolder = 'grafana.app/folder';
export const AnnoKeyFolderTitle = 'grafana.app/folderTitle';
export const AnnoKeyFolderId = 'grafana.app/folderId';
export const AnnoKeyFolderUrl = 'grafana.app/folderUrl';
export const AnnoKeyMessage = 'grafana.app/message';
export const AnnoKeySlug = 'grafana.app/slug';
export const AnnoKeyDashboardId = 'grafana.app/dashboardId';

// Identify where values came from
export const AnnoKeyRepoName = 'grafana.app/repoName';
export const AnnoKeyRepoPath = 'grafana.app/repoPath';
export const AnnoKeyRepoHash = 'grafana.app/repoHash';
export const AnnoKeyRepoTimestamp = 'grafana.app/repoTimestamp';

export const AnnoKeySavedFromUI = 'grafana.app/saved-from-ui';
export const AnnoKeyDashboardNotFound = 'grafana.app/dashboard-not-found';
export const AnnoKeyDashboardIsSnapshot = 'grafana.app/dashboard-is-snapshot';
export const AnnoKeyDashboardSnapshotOriginalUrl = 'grafana.app/dashboard-snapshot-original-url';
export const AnnoKeyDashboardIsNew = 'grafana.app/dashboard-is-new';
export const AnnoKeyDashboardGnetId = 'grafana.app/dashboard-gnet-id';

// Annotations provided by the API
type GrafanaAnnotations = {
  [AnnoKeyCreatedBy]?: string;
  [AnnoKeyUpdatedTimestamp]?: string;
  [AnnoKeyUpdatedBy]?: string;
  [AnnoKeyFolder]?: string;
  [AnnoKeySlug]?: string;
  [AnnoKeyDashboardId]?: number;

  [AnnoKeyRepoName]?: string;
  [AnnoKeyRepoPath]?: string;
  [AnnoKeyRepoHash]?: string;
  [AnnoKeyRepoTimestamp]?: string;
};

// Annotations provided by the front-end client
type GrafanaClientAnnotations = {
  [AnnoKeyMessage]?: string;
  [AnnoKeyFolderTitle]?: string;
  [AnnoKeyFolderUrl]?: string;
  [AnnoKeyFolderId]?: number;
  [AnnoKeyFolderId]?: number;
  [AnnoKeySavedFromUI]?: string;
  [AnnoKeyDashboardNotFound]?: boolean;
  [AnnoKeyDashboardIsSnapshot]?: boolean;
  [AnnoKeyDashboardSnapshotOriginalUrl]?: string;
  [AnnoKeyDashboardIsNew]?: boolean;

  // TODO: This should be provided by the API
  // This is the dashboard ID for the Gcom API. This set when a dashboard is created through importing a dashboard from Grafana.com.
  [AnnoKeyDashboardGnetId]?: string;
};

export interface Resource<T = object, S = object, K = string> extends TypeMeta<K> {
  metadata: ObjectMeta;
  spec: T;
  status?: S;
}

export interface ResourceForCreate<T = object, K = string> extends Partial<TypeMeta<K>> {
  metadata: Partial<ObjectMeta> & {
    // When creating a resource, it must set a name or generateName to create a unique one on the server
    generateName?: string;
  };
  spec: T;
}

export interface ListMeta {
  resourceVersion: string;
  continue?: string;
  remainingItemCount?: number;
}

export interface ResourceList<T, S = object, K = string> extends TypeMeta {
  metadata: ListMeta;
  items: Array<Resource<T, S, K>>;
}

export type ListOptionsLabelSelector =
  | string
  | Array<
      | {
          key: string;
          operator: '=' | '!=';
          value: string;
        }
      | {
          key: string;
          operator: 'in' | 'notin';
          value: string[];
        }
      | {
          key: string;
          operator: '' | '!';
        }
    >;

export type ListOptionsFieldSelector =
  | string
  | Array<{
      key: string;
      operator: '=' | '!=';
      value: string;
    }>;

export interface ListOptions {
  // continue the list at a given batch
  continue?: string;

  // Query by labels
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
  labelSelector?: ListOptionsLabelSelector;

  // Query by fields
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/
  fieldSelector?: ListOptionsFieldSelector;

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

export interface ResourceClient<T = object, S = object, K = string> {
  create(obj: ResourceForCreate<T, K>): Promise<Resource<T, S, K>>;
  get(name: string): Promise<Resource<T, S, K>>;
  subresource<S>(name: string, path: string): Promise<S>;
  list(opts?: ListOptions): Promise<ResourceList<T, S, K>>;
  update(obj: ResourceForCreate<T, K>): Promise<Resource<T, S, K>>;
  delete(name: string): Promise<MetaStatus>;
}

export interface K8sAPIGroup {
  name: string;
  versions: Array<{ groupVersion: string; version: string }>;
  preferredVersion: { groupVersion: string; version: string };
}
export interface K8sAPIGroupList {
  kind: 'APIGroupList';
  groups: K8sAPIGroup[];
}
