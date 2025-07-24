import { ReactNode } from 'react';
import { Path, UseFormReturn } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';

import {
  BitbucketRepositoryConfig,
  GitHubRepositoryConfig,
  GitLabRepositoryConfig,
  GitRepositoryConfig,
  LocalRepositoryConfig,
  RepositorySpec,
} from '../../api/clients/provisioning/v0alpha1';

// Repository type definition - extracted from API client
export type RepositoryType = RepositorySpec['type'];

// Field configuration interface
export interface RepositoryFieldData {
  label: string;
  type: 'text' | 'secret' | 'switch' | 'select' | 'checkbox' | 'custom' | 'component' | 'number';
  description?: string | ReactNode;
  placeholder?: string;
  path?: Path<RepositoryFormData>; // Optional nested field path, e.g., 'sync.intervalSeconds'
  validation?: {
    required?: boolean | string;
    message?: string;
    validate?: (value: unknown) => boolean | string;
  };
  defaultValue?: SelectableValue<string> | string | boolean;
  options?: Array<SelectableValue<string>>;
  multi?: boolean;
  allowCustomValue?: boolean;
  hidden?: boolean;
  content?: (setValue: UseFormReturn<RepositoryFormData>['setValue']) => ReactNode; // For custom fields
}

export type RepositoryFormData = Omit<RepositorySpec, 'workflows' | RepositorySpec['type']> &
  BitbucketRepositoryConfig &
  GitRepositoryConfig &
  GitHubRepositoryConfig &
  GitLabRepositoryConfig &
  LocalRepositoryConfig & {
    readOnly: boolean;
    prWorkflow: boolean;
  };

export type RepositorySettingsField = Path<RepositoryFormData>;

// Section configuration
export interface RepositorySection {
  name: string;
  id: string;
  hidden?: boolean;
  fields: RepositorySettingsField[];
}

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
  metadata?: Record<string, unknown>;
  items?: HistoryItem[];
};

export interface ProvisioningErrorInfo {
  title?: string;
  message?: string | string[];
}
