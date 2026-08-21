/**
 * Types for the Migration Wizard
 */

export enum StepKey {
  Notifications = 'notifications',
  Rules = 'rules',
  Review = 'review',
}

export type ImportMethod = 'stage' | 'legacy-datasource-rules';

/**
 * Minimal form shape for cross-cutting `useWatch` calls inside `Wizard/` (e.g.
 * `useIsRulesForcedSkipped`) — avoids an import cycle with `ImportToGMA.tsx`.
 */
export interface WizardFormValues {
  autoSyncNotificationsEnabled?: boolean;
  notificationsSource: 'yaml' | 'datasource';
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

type NotificationsSourceType = 'yaml' | 'datasource';

export interface NotificationsSourceOption {
  label: string;
  description: string;
  value: NotificationsSourceType;
}

type RulesSourceType = 'datasource' | 'yaml';

export interface RulesSourceOption {
  label: string;
  description: string;
  value: RulesSourceType;
}
