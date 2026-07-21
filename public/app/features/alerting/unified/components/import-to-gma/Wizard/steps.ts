import { t } from '@grafana/i18n';

import {
  type ImportMethod,
  type NotificationsSourceOption,
  type RulesSourceOption,
  StepKey,
  type WizardStep,
} from './types';

/**
 * Whether the selected import method is the continuous auto-sync method (which
 * collapses the wizard to a confirmation step) rather than a one-time import.
 */
export function isAutoSyncMethod(method: ImportMethod): boolean {
  return method === 'autosync';
}

/**
 * Returns the wizard steps configuration.
 * Uses a function to ensure translations are evaluated at runtime.
 */
/**
 * Returns the wizard steps configuration for the selected import method.
 * Uses a function to ensure translations are evaluated at runtime.
 */
export const getWizardSteps = (method: ImportMethod): WizardStep[] => {
  const methodStep: WizardStep = {
    id: StepKey.Method,
    name: t('alerting.import-to-gma.wizard.step-method', 'Import method'),
    description: t('alerting.import-to-gma.wizard.step-method-desc', 'How to bring resources into Grafana'),
  };

  // Auto-sync needs no per-resource configuration, so the import steps are skipped
  // entirely and the wizard collapses to a single confirmation step.
  if (isAutoSyncMethod(method)) {
    return [
      methodStep,
      {
        id: StepKey.ReviewEnable,
        name: t('alerting.import-to-gma.wizard.step-review-enable', 'Review & enable'),
        description: t('alerting.import-to-gma.wizard.step-review-enable-desc', 'Confirm and enable auto-sync'),
      },
    ];
  }

  return [
    methodStep,
    {
      id: StepKey.Notifications,
      name: t('alerting.import-to-gma.wizard.step-notifications', 'Notification resources'),
      description: t('alerting.import-to-gma.wizard.step-notifications-desc', 'Contact points, policies, templates'),
    },
    {
      id: StepKey.Rules,
      name: t('alerting.import-to-gma.wizard.step-rules', 'Alert rules'),
      description: t('alerting.import-to-gma.wizard.step-rules-desc', 'Alert and recording rules'),
    },
    {
      id: StepKey.Review,
      name: t('alerting.import-to-gma.wizard.step-review', 'Review & import'),
      description: t('alerting.import-to-gma.wizard.step-review-desc', 'Preview and confirm import'),
    },
  ];
};

/**
 * Get the next step in the wizard
 */
export const getNextStep = (currentStep: StepKey, method: ImportMethod): WizardStep | undefined => {
  const steps = getWizardSteps(method);
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return steps[currentIndex + 1];
};

/**
 * Get the previous step in the wizard
 */
export const getPreviousStep = (currentStep: StepKey, method: ImportMethod): WizardStep | undefined => {
  const steps = getWizardSteps(method);
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return currentIndex > 0 ? steps[currentIndex - 1] : undefined;
};

/**
 * Check if the current step is the first step
 */
export const isFirstStep = (currentStep: StepKey): boolean => {
  return currentStep === StepKey.Method;
};

/**
 * Check if the current step is the last step (review)
 */
export const isLastStep = (currentStep: StepKey, method: ImportMethod): boolean => {
  return currentStep === (isAutoSyncMethod(method) ? StepKey.ReviewEnable : StepKey.Review);
};

/**
 * Returns the source options for importing Alertmanager notification resources (Step 1).
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
 * @param includeYaml - Whether to include the YAML option (based on feature flag)
 */
export const getRulesSourceOptions = (includeYaml: boolean): RulesSourceOption[] => {
  const options: RulesSourceOption[] = [
    {
      label: t('alerting.import-to-gma.step2.source.datasource', 'Data source'),
      description: t(
        'alerting.import-to-gma.step2.source.datasource-desc',
        'Import from a Prometheus, Mimir, or Loki data source'
      ),
      value: 'datasource',
    },
  ];

  if (includeYaml) {
    options.push({
      label: t('alerting.import-to-gma.step2.source.yaml', 'YAML file'),
      description: t('alerting.import-to-gma.step2.source.yaml-desc', 'Import from a Prometheus rules YAML file'),
      value: 'yaml',
    });
  }

  return options;
};

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
