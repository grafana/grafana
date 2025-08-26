/**
 * This file holds generic kubernetes compatible types.
 *
 * This is very much a work in progress aiming to simplify common access patterns for k8s resource
 * Please update and improve types/utilities while we find a good pattern here!
 *
 * Once this is more stable and represents a more general pattern, it should be moved to @grafana/data
 *
 */

import { Observable } from 'rxjs';

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
  // Incremented by the server when the value of spec changes
  generation?: number;
  // The first time this was saved
  creationTimestamp: string;
  // General resource annotations -- including the common grafana.app values
  annotations?: GrafanaAnnotations & GrafanaClientAnnotations;
  // General application level key+value pairs
  labels?: GrafanaLabels;
}

export const AnnoKeyCreatedBy = 'grafana.app/createdBy';
export const AnnoKeyUpdatedTimestamp = 'grafana.app/updatedTimestamp';
export const AnnoKeyUpdatedBy = 'grafana.app/updatedBy';
export const AnnoKeyFolder = 'grafana.app/folder';
export const AnnoKeyMessage = 'grafana.app/message';

export enum ManagerKind {
  Repo = 'repo',
  Terraform = 'terraform',
  Kubectl = 'kubectl',
  Plugin = 'plugin',
}

export const AnnoKeyManagerKind = 'grafana.app/managedBy';
export const AnnoKeyManagerIdentity = 'grafana.app/managerId';
export const AnnoKeyManagerAllowsEdits = 'grafana.app/managerAllowsEdits';
export const AnnoKeySourcePath = 'grafana.app/sourcePath';
export const AnnoKeySourceChecksum = 'grafana.app/sourceChecksum';
export const AnnoKeySourceTimestamp = 'grafana.app/sourceTimestamp';

// for auditing... when saving from the UI, mark which version saved it from where
export const AnnoKeySavedFromUI = 'grafana.app/saved-from-ui';

// Grant permissions to the created resource
export const AnnoKeyGrantPermissions = 'grafana.app/grant-permissions';

/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeySlug = 'grafana.app/slug';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyDashboardIsSnapshot = 'grafana.app/dashboard-is-snapshot';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyDashboardSnapshotOriginalUrl = 'grafana.app/dashboard-snapshot-original-url';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyDashboardGnetId = 'grafana.app/dashboard-gnet-id';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyFolderTitle = 'grafana.app/folderTitle';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyFolderUrl = 'grafana.app/folderUrl';
/** @deprecated NOT A REAL annotation -- this is just a shim */
export const AnnoKeyEmbedded = 'grafana.app/embedded';

/** @experimental only provided by proxies for setup with reloadDashboardsOnParamsChange toggle on */
/** Not intended to be used in production, we will be removing this in short-term future */
export const AnnoReloadOnParamsChange = 'grafana.app/reloadOnParamsChange';

// labels
export const DeprecatedInternalId = 'grafana.app/deprecatedInternalID';

// Annotations provided by the API
type GrafanaAnnotations = {
  [AnnoKeyCreatedBy]?: string;
  [AnnoKeyUpdatedTimestamp]?: string;
  [AnnoKeyUpdatedBy]?: string;
  [AnnoKeyFolder]?: string;

  [AnnoKeyManagerKind]?: ManagerKind;
  [AnnoKeyManagerIdentity]?: string;
  [AnnoKeyManagerAllowsEdits]?: string;
  [AnnoKeySourcePath]?: string;
  [AnnoKeySourceChecksum]?: string;
  [AnnoKeySourceTimestamp]?: string;

  /** @experimental only provided by proxies for setup with reloadDashboardsOnParamsChange toggle on */
  /** Not intended to be used in production, we will be removing this in short-term future */
  [AnnoReloadOnParamsChange]?: boolean;
};

// Annotations provided by the front-end client
type GrafanaClientAnnotations = {
  [AnnoKeyMessage]?: string;

  [AnnoKeySlug]?: string;
  [AnnoKeyFolderTitle]?: string;
  [AnnoKeyFolderUrl]?: string;
  [AnnoKeySavedFromUI]?: string;
  [AnnoKeyDashboardIsSnapshot]?: string;
  [AnnoKeyDashboardSnapshotOriginalUrl]?: string;
  [AnnoKeyEmbedded]?: string;

  [AnnoKeyGrantPermissions]?: string;
  // TODO: This should be provided by the API
  // This is the dashboard ID for the Gcom API. This set when a dashboard is created through importing a dashboard from Grafana.com.
  [AnnoKeyDashboardGnetId]?: string;
};

// Labels
type GrafanaLabels = {
  [DeprecatedInternalId]?: string;
};

export interface GroupVersionResource {
  group: string;
  version: string;
  resource: string;
}

export interface GroupVersionKind {
  group: string;
  version: string;
  kind: string;
}

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

  // Watch for changes
  watch?: boolean;
}

export interface WatchOptions {
  // A specific resource
  name?: string;

  // Start watching from a given resource version
  resourceVersion?: string;

  // Query by labels
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
  labelSelector?: ListOptionsLabelSelector;

  // Query by fields
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/
  fieldSelector?: ListOptionsFieldSelector;
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

export interface ResourceEvent<T = object, S = object, K = string> {
  type: 'ADDED' | 'DELETED' | 'MODIFIED';
  object: Resource<T, S, K>;
}

export type ResourceClientWriteParams = {
  dryRun?: 'All';
  fieldValidation?: 'Ignore' | 'Warn' | 'Strict';
};

export interface ResourceClient<T = object, S = object, K = string> {
  get(name: string): Promise<Resource<T, S, K>>;
  create(obj: ResourceForCreate<T, K>, params?: ResourceClientWriteParams): Promise<Resource<T, S, K>>;
  update(obj: ResourceForCreate<T, K>, params?: ResourceClientWriteParams): Promise<Resource<T, S, K>>;
  delete(name: string, showSuccessAlert?: boolean): Promise<MetaStatus>;
  list(opts?: ListOptions): Promise<ResourceList<T, S, K>>;
  subresource<S>(name: string, path: string, params?: Record<string, unknown>): Promise<S>;
  watch(opts?: WatchOptions): Observable<ResourceEvent<T, S, K>>;
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

/**
 * Generic types to match the generated k8s API types in the RTK query clients
 */
export interface GeneratedObjectMeta extends Partial<ObjectMeta> {}
export interface GeneratedResource<T = object, S = object, K = string> extends Partial<TypeMeta<K>> {
  metadata?: GeneratedObjectMeta;
  spec?: T;
  status?: S;
}

export interface GeneratedResourceList<Spec, Status, K = string> {
  metadata?: Partial<ListMeta>;
  items?: Array<GeneratedResource<Spec, Status, K>>;
}
