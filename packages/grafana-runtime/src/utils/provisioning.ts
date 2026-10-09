/**
 * Provisioning (Git Sync) support for app plugins. See `public/app/features/provisioning/README.md`.
 *
 * @public
 */

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

/**
 * Exposed component: a drawer that commits a resource to a Git Sync repository.
 * Use it with `usePluginComponent(SaveResourceDrawerComponent)`.
 */
export const SaveResourceDrawerComponent = 'grafana/provisioning/save-resource-drawer/v1';

export interface SaveResourceDrawerProps {
  /** The resource to commit. `apiVersion`, `kind`, `metadata.name` and `spec` are written to the file. */
  resource: ManagedResource & { apiVersion?: string; kind?: string; metadata?: { name?: string }; spec?: unknown };
  action: 'create' | 'update' | 'delete';
  /** Shown in the drawer and used for the commit message and the file name of a new resource. */
  title: string;
  /** For `create`: the folder the resource goes into. The drawer finds the repository from it. */
  folderName?: string;
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

/**
 * Exposed component: the banner that dashboards show after a commit to a branch, with a link to open
 * the pull request. Use it with `usePluginComponent(PullRequestBannerComponent)`.
 */
export const PullRequestBannerComponent = 'grafana/provisioning/pull-request-banner/v1';

export interface PullRequestBannerProps extends BranchCommit {
  /** What the commit did. Defaults to `create`. */
  action?: 'create' | 'update' | 'delete';
}

/**
 * Exposed component: the badge that shows which system manages a resource. Renders nothing for an
 * unmanaged resource. Use it with `usePluginComponent(ManagedBadgeComponent)`.
 */
export const ManagedBadgeComponent = 'grafana/provisioning/managed-badge/v1';

export interface ManagedBadgeProps {
  resource: ManagedResource;
}
