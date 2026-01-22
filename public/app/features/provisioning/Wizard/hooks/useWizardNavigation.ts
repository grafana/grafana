import { useCallback, useMemo, useState } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { PROVISIONING_URL } from '../../constants';
import { getWorkflows } from '../../utils/data';
import { Step } from '../Stepper';
import { StepStatusInfo, WizardFormData, WizardStep } from '../types';

export interface UseWizardNavigationParams {
  initialStep: WizardStep;
  steps: Array<Step<WizardStep>>;
  canSkipSync: boolean;
  setStepStatusInfo: (info: StepStatusInfo) => void;
  createSyncJob: (requiresMigration: boolean) => Promise<unknown>;
  navigate: (path: string) => void;
  getValues: () => WizardFormData;
  repoType: string;
  syncTarget: string;
  githubAuthType?: string;
}

export interface UseWizardNavigationReturn {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  currentStepIndex: number;
  currentStepConfig: Step<WizardStep> | undefined;
  visibleStepIndex: number;
  goToNextStep: () => Promise<void>;
  goToPreviousStep: () => void;
  markStepComplete: (step: WizardStep) => void;
}

export function useWizardNavigation({
  initialStep,
  steps,
  canSkipSync,
  setStepStatusInfo,
  createSyncJob,
  navigate,
  getValues,
  repoType,
  syncTarget,
  githubAuthType,
}: UseWizardNavigationParams): UseWizardNavigationReturn {
  const [activeStep, setActiveStep] = useState<WizardStep>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);

  const visibleSteps = useMemo(() => steps.filter((s) => s.id !== 'authType'), [steps]);

  const currentStepIndex = useMemo(() => steps.findIndex((s) => s.id === activeStep), [steps, activeStep]);
  const currentStepConfig = useMemo(() => steps[currentStepIndex], [steps, currentStepIndex]);
  const visibleStepIndex = useMemo(
    () => visibleSteps.findIndex((s) => s.id === activeStep),
    [visibleSteps, activeStep]
  );

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      let previousStepIndex = currentStepIndex - 1;

      // Handle special case: if we're on finish step and sync was skipped
      const isFinishStep = activeStep === 'finish';
      if (isFinishStep && canSkipSync) {
        previousStepIndex = currentStepIndex - 2; // Go back to bootstrap
      }

      if (previousStepIndex >= 0) {
        const previousStep = steps[previousStepIndex];
        reportInteraction('grafana_provisioning_wizard_previous_clicked', {
          fromStep: activeStep,
          toStep: previousStep.id,
          repositoryType: repoType,
        });
        setActiveStep(previousStep.id);
        // Remove current step from completed steps when going back
        setCompletedSteps((prev) => prev.filter((step) => step !== activeStep));
        setStepStatusInfo({ status: 'idle' });
      }
    }
  }, [currentStepIndex, steps, activeStep, repoType, canSkipSync, setStepStatusInfo]);

  const goToNextStep = useCallback(async () => {
    const isLastStep = currentStepIndex === steps.length - 1;

    // Only navigate to provisioning URL if we're on the actual last step
    if (isLastStep) {
      const formData = getValues();
      reportInteraction('grafana_provisioning_repository_created', {
        repositoryType: repoType,
        target: syncTarget,
        workflowsEnabled: getWorkflows(formData.repository),
        ...(repoType === 'github' && { githubAuthType }),
      });
      navigate(PROVISIONING_URL);
    } else {
      let nextStepIndex = currentStepIndex + 1;

      // Skip synchronize step if no sync is needed
      if (activeStep === 'bootstrap' && canSkipSync) {
        nextStepIndex = currentStepIndex + 2; // Skip to finish step

        // No migration needed when skipping sync
        const job = await createSyncJob(false);
        if (!job) {
          return; // Don't proceed if job creation fails
        }
      }

      if (nextStepIndex >= steps.length) {
        navigate(PROVISIONING_URL);
        return;
      }

      reportInteraction('grafana_provisioning_wizard_step_completed', {
        step: activeStep,
        repositoryType: repoType,
        target: syncTarget,
      });

      setActiveStep(steps[nextStepIndex].id);
      setCompletedSteps((prev) => [...new Set([...prev, activeStep])]);
      setStepStatusInfo({ status: 'idle' });
    }
  }, [
    currentStepIndex,
    steps,
    getValues,
    repoType,
    syncTarget,
    githubAuthType,
    navigate,
    activeStep,
    canSkipSync,
    createSyncJob,
    setStepStatusInfo,
  ]);

  const markStepComplete = useCallback((step: WizardStep) => {
    setCompletedSteps((prev) => [...new Set([...prev, step])]);
  }, []);

  return {
    activeStep,
    completedSteps,
    currentStepIndex,
    currentStepConfig,
    visibleStepIndex,
    goToNextStep,
    goToPreviousStep,
    markStepComplete,
  };
}
