/**
 * Provisioning (Git Sync) support for app plugins. See `public/app/features/provisioning/README.md`.
 *
 * @public
 */
import * as React from 'react';

export const AnnoKeyManagerKind = 'grafana.app/managedBy';
export const AnnoKeyManagerIdentity = 'grafana.app/managerId';
export const AnnoKeySourcePath = 'grafana.app/sourcePath';

/** Any k8s-style resource. Only `metadata.annotations` is read. */
export interface ManagedResource {
  metadata?: {
    annotations?: Record<string, string | undefined>;
  };
}

/** True when an external system (Git Sync, Terraform, ...) manages the resource. */
export function isManaged(resource: ManagedResource): boolean {
  return Boolean(resource.metadata?.annotations?.[AnnoKeyManagerKind]);
}

/** Which system manages the resource: `repo` for Git Sync, `terraform`, `kubectl`, `plugin`. */
export function getManagerKind(resource: ManagedResource): string | undefined {
  return resource.metadata?.annotations?.[AnnoKeyManagerKind];
}

/** The identity of the managing system, such as the Git Sync repository name. */
export function getManagerIdentity(resource: ManagedResource): string | undefined {
  return resource.metadata?.annotations?.[AnnoKeyManagerIdentity];
}

/** The path of the source file within the managing repository. */
export function getSourcePath(resource: ManagedResource): string | undefined {
  return resource.metadata?.annotations?.[AnnoKeySourcePath];
}

/**
 * True when a write failed because the target folder is managed by a Git Sync repository. Open the
 * save drawer in that case, so the user can commit the resource to the repository instead.
 */
export function isManagedFolderError(error: unknown): boolean {
  const causes = (error as { data?: { details?: { causes?: Array<{ reason?: string }> } } })?.data?.details?.causes;
  return causes?.some((c) => c.reason === 'FolderManagedByRepository') ?? false;
}

/** How Grafana shows a kind on the Git Sync pages: its name, icon and where to view it. */
export interface ResourceKindDisplay {
  /** API group, e.g. `myapp.ext.grafana.app`. */
  group: string;
  /** Kubernetes kind, e.g. `Note`. */
  kind: string;
  /** Plural resource name. Defaults to the lowercase kind plus `s`. */
  resource?: string;
  /** Singular label. Defaults to the kind. */
  label?: string;
  /** Icon name from `@grafana/ui`. Defaults to `file-alt`. */
  icon?: string;
  /** Route to one resource, given its name. */
  getRoute?: (name: string) => string;
  /** Route to the list of this kind. */
  listRoute?: string;
  /** Whether resources of this kind live in folders. Defaults to true. */
  folderScoped?: boolean;
}

type RegisterResourceKinds = (kinds: ResourceKindDisplay[]) => void;

const pending: ResourceKindDisplay[][] = [];
let registerResourceKindsImpl: RegisterResourceKinds = (kinds) => {
  pending.push(kinds);
};

/**
 * Registers the kinds an app serves, so the Git Sync pages show them with a name, icon and link.
 * Call it once from the app's `module.ts`.
 */
export function registerResourceKinds(kinds: ResourceKindDisplay[]): void {
  registerResourceKindsImpl(kinds);
}

/** @internal Used by Grafana to receive registrations, including those made before this call. */
export function setRegisterResourceKinds(impl: RegisterResourceKinds): void {
  registerResourceKindsImpl = impl;
  pending.splice(0).forEach(impl);
}

export interface SaveResourceDrawerProps {
  /** The resource to commit. `apiVersion`, `kind`, `metadata.name` and `spec` are written to the file. */
  resource: ManagedResource & { apiVersion?: string; kind?: string; metadata?: { name?: string }; spec?: unknown };
  action: 'create' | 'update' | 'delete';
  /** Shown in the drawer and used for the commit message and the file name of a new resource. */
  title: string;
  /** For `create` of a folder-scoped kind: the folder the resource goes into. The drawer finds the repository from it. */
  folderName?: string;
  /** For `create` of a folderless kind: the repository to commit to, from `RepositorySelect`. */
  repositoryName?: string;
  onDismiss?: () => void;
  /** The resource is stored in Grafana (commit to the configured branch). */
  onWriteSuccess?: (resource: unknown) => void;
  /** The resource is committed to a branch and not stored in Grafana yet. Pass the data to the PR banner. */
  onBranchSuccess?: (data: BranchCommit) => void;
}

/** A commit to a branch other than the configured one. */
export interface BranchCommit {
  /** The branch the commit went to. */
  ref: string;
  /** URL to open a pull request for the branch. Absent for a plain git repository. */
  pullRequestUrl?: string;
  repositoryUrl?: string;
  /** `github`, `gitlab`, `bitbucket`, or `git`. */
  repoType?: string;
  /** The repository's configured branch, which the pull request targets. */
  configuredBranch?: string;
}

export interface PullRequestBannerProps extends BranchCommit {
  /** What the commit did. Defaults to `create`. */
  action?: 'create' | 'update' | 'delete';
}

export interface ManagedBadgeProps {
  resource: ManagedResource;
}

export interface RepositorySelectProps {
  /** The kind the user is about to create. The select renders nothing when the kind cannot go to a repository. */
  group: string;
  kind: string;
  /** Selected repository name. Empty means the resource is stored in Grafana. */
  value?: string;
  onChange: (repositoryName: string) => void;
}

interface Components {
  SaveResourceDrawer: React.ComponentType<SaveResourceDrawerProps>;
  ManagedBadge: React.ComponentType<ManagedBadgeProps>;
  PullRequestBanner: React.ComponentType<PullRequestBannerProps>;
  RepositorySelect: React.ComponentType<RepositorySelectProps>;
}

let components: Partial<Components> = {};

/** @internal Used by Grafana at startup to provide the component implementations. */
export function setComponents(impl: Components): void {
  components = impl;
}

function shell<K extends keyof Components>(name: K): Components[K] {
  const Shell = (props: React.ComponentProps<Components[K]>) => {
    const Impl = components[name] as React.ComponentType<typeof props> | undefined;
    if (Impl) {
      return <Impl {...props} />;
    }
    if (process.env.NODE_ENV !== 'production') {
      return <div>@grafana/runtime provisioning.{name} is not set</div>;
    }
    return null;
  };
  Shell.displayName = name;
  return Shell;
}

/** A drawer that commits a resource to a Git Sync repository. */
export const SaveResourceDrawer = shell('SaveResourceDrawer');

/** The badge that shows which system manages a resource. Renders nothing for an unmanaged resource. */
export const ManagedBadge = shell('ManagedBadge');

/** The banner that dashboards show after a commit to a branch, with a link to open the pull request. */
export const PullRequestBanner = shell('PullRequestBanner');

/**
 * A form field to pick the repository for a new resource. Put it in the create form of a folderless
 * kind; pass the value to `SaveResourceDrawer` as `repositoryName`. Renders nothing when provisioning
 * is off or no repository exists.
 */
export const RepositorySelect = shell('RepositorySelect');
