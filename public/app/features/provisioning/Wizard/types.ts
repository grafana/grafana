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
export type Operation = 'pull' | 'migrate';

export interface ModeOption {
  target: Target;
  operation: Operation;
  label: string;
  description: string;
  disabledReason?: string;
  subtitle: string;
}

export interface SystemState {
  resourceCount: number;
  resourceCountString: string;

  fileCount: number;
  actions: ModeOption[];
  disabled: ModeOption[];
  folderConnected?: boolean;
}
