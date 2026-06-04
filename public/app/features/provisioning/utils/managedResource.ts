import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';

/**
 * Minimal structural shape shared by every Grafana k8s-style resource (dashboards, folders,
 * playlists, ...). Only the manager annotations are needed, so any resource that exposes
 * `metadata.annotations` — regardless of which generated client it comes from — can be passed in.
 */
export interface ManagedResource {
  metadata?: {
    annotations?: {
      [AnnoKeyManagerKind]?: string;
      [AnnoKeyManagerIdentity]?: string;
      [AnnoKeyManagerAllowsEdits]?: string;
      [AnnoKeySourcePath]?: string;
    };
  };
}

// Derived from the enum so any manager kind (repo, terraform, kubectl, plugin, grafana,
// classic-file-provisioning, ...) is recognised without maintaining a parallel list here.
const MANAGER_KINDS = new Set<string>(Object.values(ManagerKind));

function isManagerKind(value: string | undefined): value is ManagerKind {
  return value !== undefined && MANAGER_KINDS.has(value);
}

/** Returns which system manages the resource, or undefined when it is not managed. */
export function getManagerKind(resource: ManagedResource): ManagerKind | undefined {
  const kind = resource.metadata?.annotations?.[AnnoKeyManagerKind];
  return isManagerKind(kind) ? kind : undefined;
}

/** Returns the path of the resource's source file within its managing repository, if any. */
export function getSourcePath(resource: ManagedResource): string | undefined {
  return resource.metadata?.annotations?.[AnnoKeySourcePath];
}

/** Returns the identity of the managing system (e.g. the repository name), if any. */
export function getManagerIdentity(resource: ManagedResource): string | undefined {
  return resource.metadata?.annotations?.[AnnoKeyManagerIdentity];
}

/**
 * True when the resource is owned by any external manager. This is a presence check on the
 * `grafana.app/managedBy` annotation, so it also covers managers not represented by
 * {@link ManagerKind} (e.g. classic file provisioning).
 */
export function isManaged(resource: ManagedResource): boolean {
  return resource.metadata?.annotations?.[AnnoKeyManagerKind] !== undefined;
}

/**
 * True when the resource is managed through the repository (git) provisioning feature, i.e.
 * `grafana.app/managedBy === repo`. This is the condition for the "Provisioned" badge. Resources
 * managed by terraform/kubectl/plugin are managed but not repository-managed — use
 * {@link isManaged} or {@link getManagerKind} to handle those.
 */
export function isManagedByRepository(resource: ManagedResource): boolean {
  return getManagerKind(resource) === ManagerKind.Repo;
}

/**
 * True when a managed resource is read-only in the UI: it is managed by something other than the
 * repository provisioning flow (which has its own edit workflow) and that manager does not allow
 * edits via the `grafana.app/managerAllowsEdits` annotation.
 */
export function isManagedResourceReadOnly(resource: ManagedResource): boolean {
  return (
    isManaged(resource) &&
    !isManagedByRepository(resource) &&
    resource.metadata?.annotations?.[AnnoKeyManagerAllowsEdits] !== 'true'
  );
}
