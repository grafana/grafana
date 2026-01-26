import { Path } from 'react-hook-form';

import {
  BitbucketRepositoryConfig,
  ConnectionSpec,
  GitHubRepositoryConfig,
  GitLabRepositoryConfig,
  GitRepositoryConfig,
  LocalRepositoryConfig,
  RepositorySpec,
} from '../../api/clients/provisioning/v0alpha1';

// Repository type definition - extracted from API client
export type RepositoryType = RepositorySpec['type'];
export type RepoWorkflows = RepositorySpec['workflows'];

export type RepositoryFormData = Omit<RepositorySpec, 'workflows' | RepositorySpec['type']> &
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
  };

export type RepositorySettingsField = Path<RepositoryFormData>;

// Connection type definition - extracted from API client
export type ConnectionType = ConnectionSpec['type'];

export type ConnectionFormData = {
  type: ConnectionSpec['type'];
  appID: string;
  installationID: string;
  privateKey?: string;
};

// Added to DashboardDTO to help editor
export interface ProvisioningPreview {
  repo: string;
  file: string;
  ref?: string;
}

export type WorkflowOption = RepositorySpec['workflows'][number];

export type HistoryItem = {
  ref: string;
  message: string;
  createdAt?: number;
  authors: AuthorInfo[];
};

export type AuthorInfo = {
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

// Tree view types for combined Resources/Files view
export type ItemType = 'Folder' | 'File' | 'Dashboard';
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
}

export interface FlatTreeItem {
  item: TreeItem;
  level: number;
}
