import { RepositorySpec, SyncOptions } from 'app/api/clients/provisioning/v0alpha1';

import { ProvisioningErrorInfo, RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'bootstrap' | 'finish' | 'synchronize';

export type RepoType = RepositorySpec['type'];

export interface MigrateFormData {
  history: boolean;
  identifier: boolean;
}

export interface WizardFormData {
  repository: RepositoryFormData;
  migrate?: MigrateFormData;
  repositoryName?: string;
}

export type Target = SyncOptions['target'];

export interface ModeOption {
  target: Target;
  label: string;
  description: string;
  subtitle: string;
}

export type StepStatus = 'idle' | 'running' | 'error' | 'success';

export const RepoTypeDisplay: { [key in RepoType]: string } = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  git: 'Git',
  local: 'Local',
};

export type StepStatusInfo =
  | { status: 'idle' | 'running' | 'success' }
  | { status: 'error'; error: string | ProvisioningErrorInfo }
  | { status: 'warning'; warning: string | ProvisioningErrorInfo };
