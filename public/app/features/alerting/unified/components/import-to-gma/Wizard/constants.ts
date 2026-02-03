import { t } from '@grafana/i18n';

import { StepKey, WizardStep } from './types';

/**
 * Returns the wizard steps configuration.
 * Uses a function to ensure translations are evaluated at runtime.
 */
export const getWizardSteps = (): WizardStep[] => [
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

/**
 * Get the next step in the wizard
 */
export const getNextStep = (currentStep: StepKey): WizardStep | undefined => {
  const steps = getWizardSteps();
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return steps[currentIndex + 1];
};

/**
 * Get the previous step in the wizard
 */
export const getPreviousStep = (currentStep: StepKey): WizardStep | undefined => {
  const steps = getWizardSteps();
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return currentIndex > 0 ? steps[currentIndex - 1] : undefined;
};

/**
 * Check if the current step is the first step
 */
export const isFirstStep = (currentStep: StepKey): boolean => {
  return currentStep === StepKey.Notifications;
};

/**
 * Check if the current step is the last step (review)
 */
export const isLastStep = (currentStep: StepKey): boolean => {
  return currentStep === StepKey.Review;
};
