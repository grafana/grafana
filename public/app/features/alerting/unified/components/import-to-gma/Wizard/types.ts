/**
 * Types for the Migration Wizard
 */

export enum StepKey {
  Notifications = 'notifications',
  Rules = 'rules',
  Review = 'review',
}

export enum StepState {
  Idle = 'idle',
  Visited = 'visited',
}

export interface WizardStep {
  id: StepKey;
  name: string;
  description: string;
}

export type VisitedSteps = Partial<Record<StepKey, StepState>>;

export type NotificationsSourceType = 'yaml' | 'datasource';

export interface NotificationsSourceOption {
  label: string;
  description: string;
  value: NotificationsSourceType;
}

export type RulesSourceType = 'datasource' | 'yaml';

export interface RulesSourceOption {
  label: string;
  description: string;
  value: RulesSourceType;
}

export type PolicyOptionValue = 'default' | 'imported' | 'manual';

export interface PolicyOption {
  label: string;
  value: PolicyOptionValue;
  description: string;
}
