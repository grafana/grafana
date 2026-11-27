import { t } from '@grafana/i18n';

import { type ImportFormValues } from '../types';

import { type NotificationsSourceOption, type RulesSourceOption, StepKey, type WizardStep } from './types';

/** Settings > Import runs the full list. The rules importer, for users who can't open Settings, runs the short one. */
export const WIZARD_STEPS = {
  full: [StepKey.Notifications, StepKey.Rules, StepKey.Review],
  rulesOnly: [StepKey.Rules, StepKey.Review],
};

/**
 * Returns the wizard steps configuration.
 * Uses a function to ensure translations are evaluated at runtime.
 */
export const getWizardSteps = (stepKeys: StepKey[] = WIZARD_STEPS.full): WizardStep[] => {
  const steps: Record<StepKey, WizardStep> = {
    [StepKey.Notifications]: {
      id: StepKey.Notifications,
      name: t('alerting.import-to-gma.wizard.step-notifications', 'Notification configuration'),
      description: t('alerting.import-to-gma.wizard.step-notifications-desc', 'Contact points, policies, templates'),
    },
    [StepKey.Rules]: {
      id: StepKey.Rules,
      name: t('alerting.import-to-gma.wizard.step-rules', 'Rules'),
      description: t('alerting.import-to-gma.wizard.step-rules-desc', 'Alert and recording rules'),
    },
    [StepKey.Review]: {
      id: StepKey.Review,
      name: t('alerting.import-to-gma.wizard.step-review', 'Review & import'),
      description: t('alerting.import-to-gma.wizard.step-review-desc', 'Preview and confirm import'),
    },
  };
  return stepKeys.map((key) => steps[key]);
};

/** Whether Step 1's notifications will be handled via continuous Auto-sync instead of a one-time import. */
export function isAutoSyncSelected(
  autoSyncNotificationsEnabled: boolean,
  notificationsSource: 'yaml' | 'datasource'
): boolean {
  return autoSyncNotificationsEnabled && notificationsSource === 'datasource';
}

/**
 * Whether Auto-sync will actually be enabled on confirm. Skipping Step 1 discards whatever was
 * selected there — same rule the plain notifications import already follows via
 * `step1Completed && !step1Skipped` — so an Auto-sync selection left behind by a skip must not
 * take effect either.
 */
export function isAutoSyncCommitted(
  autoSyncNotificationsEnabled: boolean,
  notificationsSource: 'yaml' | 'datasource',
  step1Skipped: boolean
): boolean {
  return isAutoSyncSelected(autoSyncNotificationsEnabled, notificationsSource) && !step1Skipped;
}

export interface ImportPlan {
  willEnableAutoSync: boolean;
  willImportNotifications: boolean;
  willImportRules: boolean;
}

/** What confirming the import will do, from the steps the user completed or skipped. */
export function getImportPlan(
  values: Pick<
    ImportFormValues,
    | 'autoSyncNotificationsEnabled'
    | 'notificationsSource'
    | 'step1Completed'
    | 'step1Skipped'
    | 'step2Completed'
    | 'step2Skipped'
  >
): ImportPlan {
  return {
    willEnableAutoSync: isAutoSyncCommitted(
      values.autoSyncNotificationsEnabled ?? false,
      values.notificationsSource,
      values.step1Skipped
    ),
    willImportNotifications: values.step1Completed && !values.step1Skipped,
    willImportRules: values.step2Completed && !values.step2Skipped,
  };
}

export const getNextStep = (currentStep: StepKey, steps = getWizardSteps()): WizardStep | undefined => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return steps[currentIndex + 1];
};

export const getPreviousStep = (currentStep: StepKey, steps = getWizardSteps()): WizardStep | undefined => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  if (currentIndex <= 0) {
    return undefined;
  }
  return steps[currentIndex - 1];
};

/**
 * Check if the current step is the last step (review)
 */
export const isLastStep = (currentStep: StepKey): boolean => {
  return currentStep === StepKey.Review;
};

/**
 * Returns the source options for importing Alertmanager notification configuration (Step 1).
 * Uses a function to ensure translations are evaluated at runtime.
 */
export const getNotificationsSourceOptions = (): NotificationsSourceOption[] => [
  {
    label: t('alerting.import-to-gma.step1.source.yaml', 'YAML file'),
    description: t(
      'alerting.import-to-gma.step1.source.yaml-desc',
      'Import from an Alertmanager configuration YAML file'
    ),
    value: 'yaml',
  },
  {
    label: t('alerting.import-to-gma.step1.source.datasource', 'Data source'),
    description: t('alerting.import-to-gma.step1.source.datasource-desc', 'Import from an Alertmanager data source'),
    value: 'datasource',
  },
];

/**
 * Returns the source options for importing alert rules (Step 2).
 * Uses a function to ensure translations are evaluated at runtime.
 */
export const getRulesSourceOptions = (): RulesSourceOption[] => [
  {
    label: t('alerting.import-to-gma.step2.source.datasource', 'Data source'),
    description: t(
      'alerting.import-to-gma.step2.source.datasource-desc',
      'Import from a Prometheus, Mimir, or Loki data source'
    ),
    value: 'datasource',
  },
  {
    label: t('alerting.import-to-gma.step2.source.yaml', 'YAML file'),
    description: t('alerting.import-to-gma.step2.source.yaml-desc', 'Import from a Prometheus rules YAML file'),
    value: 'yaml',
  },
];

/**
 * Returns a label describing which rules will be paused after import.
 */
export function getPauseRulesLabel(pauseAlertingRules: boolean, pauseRecordingRules: boolean): string {
  if (pauseAlertingRules && pauseRecordingRules) {
    return t('alerting.import-to-gma.review.pause-all', 'All rules paused');
  }
  if (pauseAlertingRules) {
    return t('alerting.import-to-gma.review.pause-alerting', 'Alert rules paused');
  }
  if (pauseRecordingRules) {
    return t('alerting.import-to-gma.review.pause-recording', 'Recording rules paused');
  }
  return t('alerting.import-to-gma.review.pause-none', 'No rules paused');
}
