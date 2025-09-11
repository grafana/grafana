import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, isFetchError } from '@grafana/runtime';
import { Box, Button, ConfirmModal, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { getDefaultValues } from '../Config/defaults';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { dataToSpec } from '../utils/data';
import { getFormErrors } from '../utils/getFormErrors';

import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { useStepStatus } from './StepStatusContext';
import { Step, Stepper } from './Stepper';
import { SynchronizeStep } from './SynchronizeStep';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useResourceStats } from './hooks/useResourceStats';
import { RepoType, WizardFormData, WizardStep } from './types';

const appEvents = getAppEvents();

const getSteps = (): Array<Step<WizardStep>> => {
  return [
    {
      id: 'connection',
      name: t('provisioning.wizard.step-connect', 'Connect'),
      title: t('provisioning.wizard.title-connect', 'Connect to external storage'),
      submitOnNext: true,
    },
    {
      id: 'bootstrap',
      name: t('provisioning.wizard.step-bootstrap', 'Choose what to synchronize'),
      title: t('provisioning.wizard.title-bootstrap', 'Choose what to synchronize'),
      submitOnNext: true,
    },
    {
      id: 'synchronize',
      name: t('provisioning.wizard.step-synchronize', 'Synchronize with external storage'),
      title: t('provisioning.wizard.title-synchronize', 'Synchronize with external storage'),
      submitOnNext: false,
    },
    {
      id: 'finish',
      name: t('provisioning.wizard.step-finish', 'Choose additional settings'),
      title: t('provisioning.wizard.title-finish', 'Choose additional settings'),
      submitOnNext: true,
    },
  ];
};

export function ProvisioningWizard({ type }: { type: RepoType }) {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const { stepStatusInfo, setStepStatusInfo, isStepSuccess, isStepRunning, hasStepError, hasStepWarning } =
    useStepStatus();

  const isSyncCompleted = activeStep === 'synchronize' && (isStepSuccess || hasStepWarning || hasStepError);
  const isFinishWithSyncCompleted =
    activeStep === 'finish' && (isStepSuccess || completedSteps.includes('synchronize'));
  const shouldUseCancelBehavior = activeStep === 'connection' || isSyncCompleted || isFinishWithSyncCompleted;

  const { data } = useGetFrontendSettingsQuery();
  const isLegacyStorage = Boolean(data?.legacyStorage);
  const navigate = useNavigate();

  const steps = getSteps();
  const styles = useStyles2(getStyles);

  const values = getDefaultValues();
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { ...values, type },
      migrate: {
        history: true,
      },
    },
  });

  const {
    watch,
    setValue,
    getValues,
    trigger,
    setError,
    formState: { isDirty },
    handleSubmit,
  } = methods;

  const [repoName = '', repoType] = watch(['repositoryName', 'repository.type']);
  const [submitData] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const {
    shouldSkipSync,
    requiresMigration,
    isLoading: isResourceStatsLoading,
  } = useResourceStats(repoName, isLegacyStorage);
  const { createSyncJob, isLoading: isCreatingSkipJob } = useCreateSyncJob({
    repoName: repoName,
    requiresMigration,
    repoType,
    isLegacyStorage,
    setStepStatusInfo,
  });

  const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
  const currentStepConfig = steps[currentStepIndex];

  const canSkipSync = repoName && !isResourceStatsLoading && shouldSkipSync;

  // A different repository is marked with instance target -- nothing will succeed
  useEffect(() => {
    if (data?.items.some((item) => item.target === 'instance' && item.name !== repoName)) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('provisioning.wizard-content.error-instance-repository-exists', 'Instance repository already exists'),
        ],
      });

      navigate(PROVISIONING_URL);
    }
  }, [navigate, repoName, data?.items]);

  const handleRepositoryDeletion = async (name: string) => {
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
  };

  const handleBack = () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);

    if (currentStepIndex > 0) {
      let previousStepIndex = currentStepIndex - 1;

      // Handle special case: if we're on finish step and sync was skipped
      if (activeStep === 'finish' && canSkipSync) {
        previousStepIndex = currentStepIndex - 2; // Go back to bootstrap
      }

      if (previousStepIndex >= 0) {
        const previousStep = steps[previousStepIndex];
        setActiveStep(previousStep.id);
        // Remove current step from completed steps when going back
        setCompletedSteps((prev) => prev.filter((step) => step !== activeStep));
        setStepStatusInfo({ status: 'idle' });
      }
    }
  };

  const onDiscard = async () => {
    if (repoName) {
      await handleRepositoryDeletion(repoName);
    }

    await handlePrevious();
  };

  const handlePrevious = async () => {
    // For cancel actions, show confirmation modal
    if (shouldUseCancelBehavior) {
      if (!repoName) {
        navigate(PROVISIONING_URL);
        return;
      }
      setShowCancelConfirmation(true);
      return;
    }

    // For other steps, go back one step
    handleBack();
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    handleRepositoryDeletion(repoName);
  };

  // Calculate button text based on current step position
  const getNextButtonText = useCallback(
    (currentStep: WizardStep) => {
      const stepIndex = steps.findIndex((s) => s.id === currentStep);

      // Guard against index out of bounds
      if (stepIndex === -1 || stepIndex >= steps.length - 1) {
        return t('provisioning.wizard.button-next', 'Finish');
      }

      // If on bootstrap step and should skip sync, show finish step name
      if (currentStep === 'bootstrap' && canSkipSync) {
        const finishStepIndex = stepIndex + 2;
        if (finishStepIndex < steps.length) {
          return steps[finishStepIndex].name;
        }
        return t('provisioning.wizard.button-next', 'Finish');
      }

      return steps[stepIndex + 1].name;
    },
    [steps, canSkipSync]
  );

  // Calculate previous/cancel button text based on current state
  const getPreviousButtonText = useCallback(() => {
    if (isCancelling) {
      return t('provisioning.wizard-content.button-cancelling', 'Cancelling...');
    }

    if (shouldUseCancelBehavior) {
      return t('provisioning.wizard-content.button-cancel', 'Cancel');
    }

    return t('provisioning.wizard-content.button-previous', 'Previous');
  }, [isCancelling, shouldUseCancelBehavior]);

  const handleNext = async () => {
    const isLastStep = currentStepIndex === steps.length - 1;

    // Only navigate to provisioning URL if we're on the actual last step
    if (isLastStep) {
      navigate(PROVISIONING_URL);
    } else {
      let nextStepIndex = currentStepIndex + 1;

      // Skip synchronize step if no sync is needed
      if (activeStep === 'bootstrap' && canSkipSync) {
        nextStepIndex = currentStepIndex + 2; // Skip to finish step

        // Create a pull job to initialize the repository
        const job = await createSyncJob();
        if (!job) {
          return; // Don't proceed if job creation fails
        }
      }

      if (nextStepIndex >= steps.length) {
        navigate(PROVISIONING_URL);
        return;
      }

      setActiveStep(steps[nextStepIndex].id);
      setCompletedSteps((prev) => [...new Set([...prev, activeStep])]);
      setStepStatusInfo({ status: 'idle' });
    }
  };

  const onSubmit = async () => {
    if (currentStepConfig?.submitOnNext) {
      // Validate form data before proceeding
      const fieldsToValidate =
        activeStep === 'connection' ? (['repository'] as const) : (['repository', 'repository.title'] as const);

      const isValid = await trigger(fieldsToValidate);
      if (!isValid) {
        return;
      }

      setIsSubmitting(true);
      try {
        const formData = getValues();
        const spec = dataToSpec(formData.repository);
        const rsp = await submitData(spec, formData.repository.token);
        if (rsp.error) {
          setStepStatusInfo({
            status: 'error',
            error: 'Repository request failed',
          });
          return;
        }

        // Fill in the k8s name from the initial POST response
        const name = rsp.data?.metadata?.name;
        if (name) {
          setValue('repositoryName', name);
          setStepStatusInfo({ status: 'success' });
          handleNext();
        } else {
          console.error('Saved repository without a name:', rsp);
        }
      } catch (error) {
        if (isFetchError(error)) {
          const [field, errorMessage] = getFormErrors(error.data.errors);
          if (field && errorMessage) {
            setError(field, errorMessage);
          }
        } else {
          setStepStatusInfo({
            status: 'error',
            error: 'Repository connection failed',
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // proceed if the job was successful or had warnings
      if (isStepSuccess || hasStepWarning) {
        handleNext();
      }
    }
  };

  const isNextButtonDisabled = () => {
    // If the step is not on Connect page, we only enable it if the job was successful
    if (activeStep !== 'connection' && hasStepError) {
      return true;
    }
    // Synchronize step requires success or warning to proceed
    if (activeStep === 'synchronize') {
      return !(isStepSuccess || hasStepWarning); // Disable next button if the step is not successful or has warnings
    }
    return isSubmitting || isCancelling || isStepRunning || isCreatingSkipJob;
  };

  return (
    <FormProvider {...methods}>
      <Stack gap={6} direction="row" alignItems="flex-start">
        <Stepper steps={steps} activeStep={activeStep} visitedSteps={completedSteps} />
        <div className={styles.divider} />
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <FormPrompt
            onDiscard={onDiscard}
            confirmRedirect={isDirty && !['connection', 'finish'].includes(activeStep) && !isCancelling}
          />
          <Stack direction="column">
            <Box marginBottom={2}>
              <Text element="h2">
                {currentStepIndex + 1}. {currentStepConfig?.title}
              </Text>
            </Box>

            {hasStepError && 'error' in stepStatusInfo && <ProvisioningAlert error={stepStatusInfo.error} />}
            {hasStepWarning && 'warning' in stepStatusInfo && <ProvisioningAlert warning={stepStatusInfo.warning} />}
            {isStepSuccess && 'success' in stepStatusInfo && <ProvisioningAlert success={stepStatusInfo.success} />}

            <div className={styles.content}>
              {activeStep === 'connection' && <ConnectStep />}
              {activeStep === 'bootstrap' && <BootstrapStep settingsData={data} repoName={repoName} />}
              {activeStep === 'synchronize' && (
                <SynchronizeStep
                  isLegacyStorage={isLegacyStorage}
                  onCancel={handleRepositoryDeletion}
                  isCancelling={isCancelling}
                />
              )}
              {activeStep === 'finish' && <FinishStep />}
            </div>

            <Stack gap={2} justifyContent="flex-end">
              <Button
                variant={'secondary'}
                onClick={handlePrevious}
                disabled={isSubmitting || isCancelling || isStepRunning || showCancelConfirmation}
              >
                {getPreviousButtonText()}
              </Button>
              <Button type={'submit'} disabled={isNextButtonDisabled()}>
                {isSubmitting
                  ? t('provisioning.wizard-content.button-submitting', 'Submitting...')
                  : getNextButtonText(activeStep)}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Stack>
      <ConfirmModal
        isOpen={showCancelConfirmation}
        title={t('provisioning.wizard.discard-modal.title', 'Discard repository setup?')}
        body={t(
          'provisioning.wizard.discard-modal.body',
          'This will delete the repository configuration and you will lose all progress. Are you sure you want to discard your changes?'
        )}
        confirmText={t('provisioning.wizard.discard-modal.confirm', 'Yes, discard')}
        dismissText={t('provisioning.wizard.discard-modal.dismiss', 'Keep working')}
        onConfirm={handleConfirmCancel}
        onDismiss={() => setShowCancelConfirmation(false)}
      />
    </FormProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    maxWidth: '900px',
    flexGrow: 1,
  }),
  divider: css({
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border.weak,
    // align with the button row
    marginBottom: theme.spacing(13),
  }),
  content: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(4),
    marginBottom: theme.spacing(4),
  }),
});
