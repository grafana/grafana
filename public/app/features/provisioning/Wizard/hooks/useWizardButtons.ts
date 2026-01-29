import { useMemo } from 'react';

import { t } from '@grafana/i18n';

import { Step } from '../Stepper';
import { WizardStep } from '../types';

export interface UseWizardButtonsParams {
  activeStep: WizardStep;
  steps: Array<Step<WizardStep>>;
  repoName: string;
  canSkipSync: boolean;
  isSubmitting: boolean;
  isCancelling: boolean;
  isStepRunning: boolean;
  isStepSuccess: boolean;
  hasStepWarning: boolean;
  isCreatingSkipJob: boolean;
  showCancelConfirmation: boolean;
  shouldUseCancelBehavior: boolean;
}

export interface UseWizardButtonsReturn {
  nextButtonText: string;
  previousButtonText: string;
  isNextDisabled: boolean;
  isPreviousDisabled: boolean;
}

export function useWizardButtons({
  activeStep,
  steps,
  repoName,
  canSkipSync,
  isSubmitting,
  isCancelling,
  isStepRunning,
  isStepSuccess,
  hasStepWarning,
  isCreatingSkipJob,
  showCancelConfirmation,
  shouldUseCancelBehavior,
}: UseWizardButtonsParams): UseWizardButtonsReturn {
  const nextButtonText = useMemo(() => {
    const stepIndex = steps.findIndex((s) => s.id === activeStep);

    if (stepIndex === -1 || stepIndex >= steps.length - 1) {
      return t('provisioning.wizard.button-next', 'Finish');
    }

    // If on bootstrap step and should skip sync, show finish step name
    if (activeStep === 'bootstrap' && canSkipSync) {
      const finishStepIndex = stepIndex + 2;
      if (finishStepIndex < steps.length) {
        return steps[finishStepIndex].name;
      }
      return t('provisioning.wizard.button-next', 'Finish');
    }

    return steps[stepIndex + 1].name;
  }, [activeStep, steps, canSkipSync]);

  const previousButtonText = useMemo(() => {
    if (isCancelling) {
      return t('provisioning.wizard-content.button-cancelling', 'Cancelling...');
    }

    if (shouldUseCancelBehavior || (activeStep === 'connection' && repoName)) {
      return t('provisioning.wizard-content.button-cancel', 'Cancel');
    }

    return t('provisioning.wizard-content.button-previous', 'Previous');
  }, [isCancelling, shouldUseCancelBehavior, activeStep, repoName]);

  const isNextDisabled = useMemo(() => {
    // Synchronize step requires success or warning to proceed (async operation result)
    if (activeStep === 'synchronize') {
      return !(isStepSuccess || hasStepWarning);
    }
    // For all other steps, rely on RHF validation - don't block based on hasStepError
    // so users can fix their input and retry
    return isSubmitting || isCancelling || isStepRunning || isCreatingSkipJob;
  }, [activeStep, isStepSuccess, hasStepWarning, isSubmitting, isCancelling, isStepRunning, isCreatingSkipJob]);

  const isPreviousDisabled = isSubmitting || isCancelling || isStepRunning || showCancelConfirmation;

  return {
    nextButtonText,
    previousButtonText,
    isNextDisabled,
    isPreviousDisabled,
  };
}
