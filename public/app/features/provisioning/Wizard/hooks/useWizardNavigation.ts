import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

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
  visibleSteps: Array<Step<WizardStep>>;
  visibleStepIndex: number;
  goToNextStep: () => Promise<void>;
  goToPreviousStep: () => void;
}

export function useWizardNavigation({
  initialStep,
  steps,
  canSkipSync,
  setStepStatusInfo,
  createSyncJob,
  getValues,
  repoType,
  syncTarget,
  githubAuthType,
}: UseWizardNavigationParams): UseWizardNavigationReturn {
  const navigate = useNavigate();
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

      const isFinishStep = activeStep === 'finish';
      if (isFinishStep && canSkipSync) {
        previousStepIndex = currentStepIndex - 2;
      }

      if (previousStepIndex >= 0) {
        const previousStep = steps[previousStepIndex];
        reportInteraction('grafana_provisioning_wizard_previous_clicked', {
          fromStep: activeStep,
          toStep: previousStep.id,
          repositoryType: repoType,
        });
        setActiveStep(previousStep.id);
        setCompletedSteps((prev) => prev.filter((step) => step !== activeStep));
        setStepStatusInfo({ status: 'idle' });
      }
    }
  }, [currentStepIndex, steps, activeStep, repoType, canSkipSync, setStepStatusInfo]);

  const goToNextStep = useCallback(async () => {
    const isLastStep = currentStepIndex === steps.length - 1;

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

      if (activeStep === 'bootstrap' && canSkipSync) {
        nextStepIndex = currentStepIndex + 2;

        const job = await createSyncJob(false);
        if (!job) {
          return;
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

  return {
    activeStep,
    completedSteps,
    currentStepIndex,
    currentStepConfig,
    visibleSteps,
    visibleStepIndex,
    goToNextStep,
    goToPreviousStep,
  };
}
