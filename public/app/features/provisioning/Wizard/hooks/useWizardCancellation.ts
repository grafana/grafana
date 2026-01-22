import { useCallback, useState } from 'react';
import { NavigateFunction } from 'react-router-dom-v5-compat';

import { reportInteraction } from '@grafana/runtime';
import { useDeleteRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../../constants';
import { RepoType, WizardStep } from '../types';

export interface UseWizardCancellationParams {
  repoName: string;
  repoType: RepoType;
  activeStep: WizardStep;
  navigate: NavigateFunction;
  handleBack: () => void;
  shouldUseCancelBehavior: boolean;
}

export interface UseWizardCancellationReturn {
  isCancelling: boolean;
  showCancelConfirmation: boolean;
  handlePrevious: () => void;
  handleConfirmCancel: () => void;
  handleDismissCancel: () => void;
  handleRepositoryDeletion: (name: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}

export function useWizardCancellation({
  repoName,
  repoType,
  activeStep,
  navigate,
  handleBack,
  shouldUseCancelBehavior,
}: UseWizardCancellationParams): UseWizardCancellationReturn {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [deleteRepository] = useDeleteRepositoryMutation();

  const handleRepositoryDeletion = useCallback(
    async (name: string) => {
      setIsCancelling(true);
      try {
        await deleteRepository({ name });
        // Wait before redirecting to ensure deletion is processed
        setTimeout(() => {
          navigate(PROVISIONING_URL);
        }, 1000);
      } catch (error) {
        setIsCancelling(false);
      }
    },
    [deleteRepository, navigate]
  );

  const handlePrevious = useCallback(() => {
    // For cancel actions, show confirmation modal
    if (shouldUseCancelBehavior) {
      if (!repoName) {
        navigate(PROVISIONING_URL);
        return;
      }
      setShowCancelConfirmation(true);
      return;
    }

    if (activeStep === 'connection' && repoName) {
      setShowCancelConfirmation(true);
      return;
    }

    handleBack();
  }, [shouldUseCancelBehavior, repoName, activeStep, navigate, handleBack]);

  const handleConfirmCancel = useCallback(() => {
    setShowCancelConfirmation(false);
    reportInteraction('grafana_provisioning_wizard_cancelled', {
      cancelledAtStep: activeStep,
      repositoryType: repoType,
    });
    handleRepositoryDeletion(repoName);
  }, [activeStep, repoType, repoName, handleRepositoryDeletion]);

  const handleDismissCancel = useCallback(() => {
    setShowCancelConfirmation(false);
  }, []);

  const onDiscard = useCallback(async () => {
    if (repoName) {
      await handleRepositoryDeletion(repoName);
    }

    await handlePrevious();
  }, [repoName, handleRepositoryDeletion, handlePrevious]);

  return {
    isCancelling,
    showCancelConfirmation,
    handlePrevious,
    handleConfirmCancel,
    handleDismissCancel,
    handleRepositoryDeletion,
    onDiscard,
  };
}
