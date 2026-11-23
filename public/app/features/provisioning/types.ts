import {
  type ConnectionGitHubConfig,
  type ConnectionGitHubEnterpriseConfig,
  type RepositoryBitbucketRepositoryConfig,
  type RepositoryBranchOptions,
  type RepositoryCommitOptions,
  type RepositoryGitHubRepositoryConfig,
  type RepositoryGitLabRepositoryConfig,
  type RepositoryGitRepositoryConfig,
  type RepositoryLocalRepositoryConfig,
  type RepositorySpec,
} from '../../api/clients/provisioning/v0alpha1';

import { type ResourceKindName } from './utils/resourceKinds';

export type JobType = 'sync' | 'delete' | 'move' | 'fix' | 'releaseResources' | 'deleteResources';

// Repository type definition - extracted from API client
export type RepoWorkflows = RepositorySpec['workflows'];

// `branch` is omitted because the spec-level `branch` (RepositoryBranchOptions:
// naming template / enforcement) collides with the git config `branch` (the
// branch name string). The branch name keeps the flat `branch` field below; the
// RepositoryBranchOptions live under `branchOptions`.
export type RepositoryFormData = Omit<RepositorySpec, 'workflows' | 'branch' | RepositorySpec['type']> &
  RepositoryBitbucketRepositoryConfig &
  RepositoryGitRepositoryConfig &
  RepositoryGitHubRepositoryConfig &
  RepositoryGitLabRepositoryConfig &
  RepositoryLocalRepositoryConfig & {
    readOnly: boolean;
    prWorkflow: boolean;
    enablePushToConfiguredBranch: boolean;
    // top-level inline secure value
    token?: string;
    signingMethod?: RepositoryCommitOptions['signingMethod'] | '';
    commitSigningKey?: string;
    smimeCertificate?: string;
    // GitHub App connection name (when using app-based auth instead of PAT)
    connectionName?: string;
    // Spec-level branch naming options (maps to RepositorySpec.branch)
    branchOptions?: RepositoryBranchOptions;
  };

// Base fields shared by all connection providers (excludes the `type` discriminant).
type ConnectionFormDataBase = {
  title: string;
  description: string;
  privateKey?: string;
  clientID?: string;
  clientSecret?: string;
  workspace?: string;
  authURL?: string;
  tokenURL?: string;
  scopes?: string[];
  webhookDisabled?: boolean;
};

type GitHubConnectionFormData = ConnectionFormDataBase &
  ConnectionGitHubConfig & { type: 'github'; serverUrl?: string };

type GitHubEnterpriseConnectionFormData = ConnectionFormDataBase &
  ConnectionGitHubEnterpriseConfig & { type: 'githubEnterprise' };

type OAuthConnectionFormData = ConnectionFormDataBase &
  Partial<ConnectionGitHubConfig> & { type: OAuthConnectionType; serverUrl?: string };

export type OAuthConnectionType =
  | 'githubOAuth'
  | 'githubEnterpriseOAuth'
  | 'gitlabOAuth'
  | 'bitbucketOAuth'
  | 'gitOAuth';

export type ConnectionFormData =
  | GitHubConnectionFormData
  | GitHubEnterpriseConnectionFormData
  | OAuthConnectionFormData;

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

/** Provisioned preview whose branch was deleted: commit the draft to a fresh branch. */
export interface RecoverToNewBranch {
  /** False when the file was born on the deleted branch and never merged, so the save must create it. */
  fileExistsOnConfiguredBranch: boolean;
}

export type WorkflowOption = RepositorySpec['workflows'][number];

type HistoryItem = {
  ref: string;
  message: string;
  createdAt?: number;
  authors: AuthorInfo[];
};

type AuthorInfo = {
  name: string;
  username: string;
  avatarURL?: string;
};

export type FileDetails = {
  path: string;
  size?: string;
  hash: string;
};

export type HistoryListResponse = {
  apiVersion?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  items?: HistoryItem[];
};

export interface StatusInfo {
  title?: string;
  message?: string | string[];
}

// Tree view types for combined Resources/Files view. The resource labels (`Dashboard`, `Playlist`,
// ...) are derived from the kind registry via `ResourceKindName`, so a new kind needs no edit here.
// `File` is the fallback for plain files/directories that don't map to a known kind; `getTreeItemKind`
// also infers `Folder` from plain directory paths that have no backing resource.
export type TreeItemKind = ResourceKindName | 'File';
export type SyncStatus = 'synced' | 'pending';

export interface TreeItem {
  title: string;
  type: TreeItemKind;
  path: string;
  level: number;
  children: TreeItem[];
  resourceName?: string;
  resource?: string;
  hash?: string;
  status?: SyncStatus;
  hasFile?: boolean;
  missingFolderMetadata?: boolean;
  metadataPath?: string;
}

export interface FlatTreeItem {
  item: TreeItem;
  level: number;
  // Whether this row is a folder with children that can be folded/unfolded.
  isExpandable: boolean;
  // Whether an expandable row is currently showing its children.
  isExpanded: boolean;
}

// External repository from the provider (e.g., GitHub)
export interface ExternalRepository {
  name?: string;
  owner?: string;
  url?: string;
}
