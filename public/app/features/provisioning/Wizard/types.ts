import { type RepositorySpec, type RepositoryUrLs, type SyncOptions } from 'app/api/clients/provisioning/v0alpha1';

import { type AlertAction } from '../Shared/ProvisioningAlert';
import { type RepositoryFormData, type StatusInfo } from '../types';

export type WizardStep = 'authType' | 'githubApp' | 'connection' | 'bootstrap' | 'finish' | 'synchronize';

export type RepoType = RepositorySpec['type'];

export type GitHubBasedConnectionType = 'github' | 'githubEnterprise';

export type GitHubAuthType = 'pat' | 'github-app' | 'oauth-app';

export type GitHubAppMode = 'existing' | 'new';

interface MigrateFormData {
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
  githubEnterprise: 'GitHub Enterprise',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  git: 'Git',
  local: 'Local',
};

export type StepStatusInfo =
  | { status: 'idle' | 'running' }
  // `urls` are the finished job's branch/PR links, present when it committed to a branch.
  | { status: 'success'; success?: string | StatusInfo; urls?: RepositoryUrLs }
  | { status: 'error'; error: string | StatusInfo; warning?: string | StatusInfo; action?: AlertAction }
  | { status: 'warning'; warning: string | StatusInfo; action?: AlertAction };

export type JobSuccess = Extract<StepStatusInfo, { status: 'success' }>;

export type ConnectionCreationResult = { success: true; connectionName: string } | { success: false; error: string };

export type InstructionAvailability = Extract<RepoType, 'bitbucket' | 'gitlab' | 'github' | 'githubEnterprise'>;
