import { RepositoryFormData } from '../types';

export type WizardStep = 'connection' | 'bootstrap' | 'migrate' | 'pull' | 'finish';

export interface MigrateFormData {
  dashboards: string[];
  folders: string[];
  history: boolean;
  identifier: boolean;
}

export interface WizardFormData {
  repository: RepositoryFormData;
  migrate?: MigrateFormData;
  repositoryName?: string;
}

export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};

export type Target = 'instance' | 'folder';
export type Operation = 'pull' | 'migrate';

export interface ModeOption {
  value: Target;
  operation: Operation;
  label: string;
  description: string;
}

export interface OptionState {
  isDisabled: boolean;
  disabledReason?: string;
}

export const modeOptions: ModeOption[] = [
  {
    value: 'instance',
    operation: 'migrate',
    label: 'Migrate Instance to Repository',
    description: 'Save all Grafana resources to repository',
  },
  {
    value: 'instance',
    operation: 'pull',
    label: 'Pull from Repository to Instance',
    description: 'Pull resources from repository into this Grafana instance',
  },
  {
    value: 'folder',
    operation: 'pull',
    label: 'Pull from Repository to Folder',
    description: 'Pull repository resources into a specific folder',
  },
];
