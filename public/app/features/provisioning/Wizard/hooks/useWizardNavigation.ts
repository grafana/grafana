import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { reportInteraction } from '@grafana/runtime';

import { PROVISIONING_URL } from '../../constants';
import { getWorkflows } from '../../utils/data';
import { Step } from '../Stepper';
import { RepoType, StepStatusInfo, WizardFormData, WizardStep } from '../types';

export interface UseWizardNavigationParams {
  steps: Array<Step<WizardStep>>;
  canSkipSync: boolean;
  setStepStatusInfo: (info: StepStatusInfo) => void;
  createSyncJob: (requiresMigration: boolean, options?: { skipStatusUpdates?: boolean }) => Promise<unknown>;
  getValues: () => WizardFormData;
  repoType: RepoType;
  syncTarget: string;
  githubAuthType?: string;
}

export interface UseWizardNavigationReturn {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  currentStepIndex: number;
  currentStepConfig: Step<WizardStep> | undefined;
  steps: Array<Step<WizardStep>>;
  visibleStepIndex: number;
  goToNextStep: () => Promise<void>;
  goToPreviousStep: () => void;
  goToStep: (stepId: WizardStep) => void;
}

export function useWizardNavigation({
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
  // local file provisioning has no auth type step
  const [activeStep, setActiveStep] = useState<WizardStep>(repoType === 'local' ? 'connection' : 'authType');
  // local file provisioning will always have the first step (authType) step completed since we skipped it
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>(() => (repoType === 'local' ? ['authType'] : []));

  const currentStepIndex = useMemo(() => steps.findIndex((s) => s.id === activeStep), [steps, activeStep]);
  const currentStepConfig = useMemo(() => steps[currentStepIndex], [steps, currentStepIndex]);
  const visibleStepIndex = useMemo(() => steps.findIndex((s) => s.id === activeStep), [steps, activeStep]);

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
      // Navigate to repository status page instead of listing page
      const repoName = formData.repositoryName;
      if (repoName) {
        navigate(`${PROVISIONING_URL}/${repoName}`);
      } else {
        navigate(PROVISIONING_URL);
      }
    } else {
      let nextStepIndex = currentStepIndex + 1;

      if (activeStep === 'bootstrap' && canSkipSync) {
        nextStepIndex = currentStepIndex + 2;

        // Fire job in background, don't wait for result - the job will be done in the background
        // and we don't care about it when skipping sync
        createSyncJob(false, { skipStatusUpdates: true });
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

  const goToStep = useCallback(
    (stepId: WizardStep) => {
      const targetIndex = steps.findIndex((s) => s.id === stepId);
      if (targetIndex >= 0) {
        setActiveStep(stepId);
        // Only keep steps completed before the target
        setCompletedSteps((prev) =>
          prev.filter((s) => {
            const sIndex = steps.findIndex((st) => st.id === s);
            return sIndex < targetIndex;
          })
        );
        setStepStatusInfo({ status: 'idle' });
      }
    },
    [steps, setStepStatusInfo]
  );

  return {
    activeStep,
    completedSteps,
    currentStepIndex,
    currentStepConfig,
    steps,
    visibleStepIndex,
    goToNextStep,
    goToPreviousStep,
    goToStep,
  };
}
