import {
  type BitbucketRepositoryConfig,
  type BranchOptions,
  type CommitOptions,
  type GitHubConnectionConfig,
  type GitHubEnterpriseConnectionConfig,
  type GitHubRepositoryConfig,
  type GitLabRepositoryConfig,
  type GitRepositoryConfig,
  type LocalRepositoryConfig,
  type RepositorySpec,
} from '../../api/clients/provisioning/v0alpha1';

import { type ResourceItemType } from './utils/resourceKinds';

export type JobType = 'sync' | 'delete' | 'move' | 'fix' | 'releaseResources' | 'deleteResources';

// Repository type definition - extracted from API client
export type RepoWorkflows = RepositorySpec['workflows'];

// `branch` is omitted because the spec-level `branch` (BranchOptions: naming
// template / enforcement) collides with the git config `branch` (the branch
// name string). The branch name keeps the flat `branch` field below; the
// BranchOptions live under `branchOptions`.
export type RepositoryFormData = Omit<RepositorySpec, 'workflows' | 'branch' | RepositorySpec['type']> &
  BitbucketRepositoryConfig &
  GitRepositoryConfig &
  GitHubRepositoryConfig &
  GitLabRepositoryConfig &
  LocalRepositoryConfig & {
    readOnly: boolean;
    prWorkflow: boolean;
    enablePushToConfiguredBranch: boolean;
    // top-level inline secure value
    token?: string;
    signingMethod?: CommitOptions['signingMethod'] | '';
    commitSigningKey?: string;
    smimeCertificate?: string;
    // GitHub App connection name (when using app-based auth instead of PAT)
    connectionName?: string;
    // Spec-level branch naming options (maps to RepositorySpec.branch)
    branchOptions?: BranchOptions;
  };

// Base fields shared by all connection providers (excludes the `type` discriminant).
type ConnectionFormDataBase = {
  title: string;
  description: string;
  privateKey?: string;
  clientID?: string;
  clientSecret?: string;
  webhookDisabled?: boolean;
};

type GitHubConnectionFormData = ConnectionFormDataBase &
  GitHubConnectionConfig & { type: 'github'; serverUrl?: string };

type GitHubEnterpriseConnectionFormData = ConnectionFormDataBase &
  GitHubEnterpriseConnectionConfig & { type: 'githubEnterprise' };

type OAuthConnectionFormData = ConnectionFormDataBase &
  Partial<GitHubConnectionConfig> & { type: OAuthConnectionType; serverUrl?: string };

export type OAuthConnectionType = 'gitlab' | 'bitbucket';

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
// ...) are derived from the kind registry via `ResourceItemType`, so a new kind needs no edit here.
// `File` is the fallback for plain files/directories that don't map to a known kind; `getItemType`
// also infers `Folder` from plain directory paths that have no backing resource.
export type ItemType = ResourceItemType | 'File';
export type SyncStatus = 'synced' | 'pending';

export interface TreeItem {
  title: string;
  type: ItemType;
  path: string;
  level: number;
  children: TreeItem[];
  resourceName?: string;
  hash?: string;
  status?: SyncStatus;
  hasFile?: boolean;
  missingFolderMetadata?: boolean;
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
