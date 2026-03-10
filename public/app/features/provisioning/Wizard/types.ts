import { RepositorySpec, SyncOptions } from 'app/api/clients/provisioning/v0alpha1';

import { AlertAction } from '../Shared/ProvisioningAlert';
import { RepositoryFormData, StatusInfo } from '../types';

export type WizardStep = 'authType' | 'githubApp' | 'connection' | 'bootstrap' | 'finish' | 'synchronize';

export type RepoType = RepositorySpec['type'];

export type GitHubAuthType = 'pat' | 'github-app';

export type GitHubAppMode = 'existing' | 'new';

export interface MigrateFormData {
  history: boolean;
  identifier: boolean;
  migrateResources?: boolean;
}

export interface WizardFormData {
  repository: RepositoryFormData;
  migrate?: MigrateFormData;
  repositoryName?: string;
  githubAuthType?: GitHubAuthType;
  githubAppMode?: GitHubAppMode;
  githubApp?: {
    connectionName?: string;
  };
}

export type Target = SyncOptions['target'];

export interface ModeOption {
  target: Target;
  label: string;
  description: string;
  subtitle: string;
  disabled: boolean;
  disabledReason?: string;
}

export const RepoTypeDisplay: { [key in RepoType]: string } = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  git: 'Git',
  local: 'Local',
};

export type StepStatusInfo =
  | { status: 'idle' | 'running' }
  | { status: 'success'; success?: string | StatusInfo }
  | { status: 'error'; error: string | StatusInfo; warning?: string | StatusInfo; action?: AlertAction }
  | { status: 'warning'; warning: string | StatusInfo };

export type ConnectionCreationResult = { success: true; connectionName: string } | { success: false; error: string };

export type InstructionAvailability = Extract<RepoType, 'bitbucket' | 'gitlab' | 'github'>;
