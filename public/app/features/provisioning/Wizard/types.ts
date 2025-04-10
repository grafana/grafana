import { RepositorySpec, SyncOptions } from 'app/api/clients/provisioning';

import { RepositoryFormData } from '../types';

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

export interface SystemState {
  resourceCount: number;
  resourceCountString: string;
  fileCount: number;
  actions: ModeOption[];
}

export type StepStatus = 'idle' | 'running' | 'error' | 'success';
export type StepStatusInfo = { status: StepStatus } | { status: 'error'; error: string };
