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
  url: string;
}

export type VisitedSteps = Partial<Record<StepKey, StepState>>;
