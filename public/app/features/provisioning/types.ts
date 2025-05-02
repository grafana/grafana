import { GitHubRepositoryConfig, LocalRepositoryConfig, RepositorySpec } from '../../api/clients/provisioning';

export type RepositoryFormData = Omit<RepositorySpec, 'github' | 'local' | 'workflows'> &
  GitHubRepositoryConfig &
  LocalRepositoryConfig & {
    readOnly: boolean;
    prWorkflow: boolean;
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
  size: string;
  hash: string;
};

export type HistoryListResponse = {
  apiVersion?: string;
  kind?: string;
  metadata?: any;
  items?: HistoryItem[];
};
