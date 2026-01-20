import { css } from '@emotion/css';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, isFetchError, reportInteraction } from '@grafana/runtime';
import { Box, Button, ConfirmModal, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepositoryViewList, useDeleteRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { getDefaultValues } from '../Config/defaults';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { dataToSpec, getWorkflows } from '../utils/data';
import { getFormErrors } from '../utils/getFormErrors';

import { AuthTypeStep } from './AuthTypeStep';
import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { GitHubAppStep, GitHubAppStepRef } from './GitHubAppStep';
import { useStepStatus } from './StepStatusContext';
import { Stepper } from './Stepper';
import { SynchronizeStep } from './SynchronizeStep';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useResourceStats } from './hooks/useResourceStats';
import { ConnectionCreationResult, RepoType, WizardFormData, WizardStep } from './types';
import { getSteps } from './utils/getSteps';

const appEvents = getAppEvents();

export const ProvisioningWizard = memo(function ProvisioningWizard({
  type,
  settingsData,
}: {
  type: RepoType;
  settingsData?: RepositoryViewList;
}) {
  const initialStep: WizardStep = type === 'github' ? 'authType' : 'connection';
  const [activeStep, setActiveStep] = useState<WizardStep>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const repositoryRequestFailed = t(
    'provisioning.provisioning-wizard.on-submit.title.repository-request-failed',
    'Repository request failed'
  );
  const repositoryConnectionFailed = t(
    'provisioning.provisioning-wizard.on-submit.title.repository-connection-failed',
    'Repository connection failed'
  );

  const { stepStatusInfo, setStepStatusInfo, isStepSuccess, isStepRunning, hasStepError, hasStepWarning } =
    useStepStatus();

  const navigate = useNavigate();
  const styles = useStyles2(getStyles);

  const values = getDefaultValues({ allowedTargets: settingsData?.allowedTargets });
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { ...values, type },
      migrate: {
        history: true,
      },
      githubAuthType: 'pat',
      githubAppMode: 'existing',
      githubApp: {},
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

  const [repoName = '', repoType, syncTarget, githubAuthType] = watch([
    'repositoryName',
    'repository.type',
    'repository.sync.target',
    'githubAuthType',
  ]);

  // Ref for GitHubAppStep to trigger submission
  const githubAppStepRef = useRef<GitHubAppStepRef>(null);

  const isSyncCompleted = activeStep === 'synchronize' && (isStepSuccess || hasStepWarning || hasStepError);
  const isFinishWithSyncCompleted =
    activeStep === 'finish' && (isStepSuccess || completedSteps.includes('synchronize'));
  const shouldUseCancelBehavior =
    activeStep === 'authType' ||
    (activeStep === 'connection' && repoType !== 'github') ||
    isSyncCompleted ||
    isFinishWithSyncCompleted;

  const steps = useMemo(() => getSteps(repoType, githubAuthType), [repoType, githubAuthType]);
  const visibleSteps = useMemo(() => steps.filter((s) => s.id !== 'authType'), [steps]);
  const [submitData] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const { shouldSkipSync, isLoading: isResourceStatsLoading } = useResourceStats(repoName, syncTarget);
  const { createSyncJob, isLoading: isCreatingSkipJob } = useCreateSyncJob({
    repoName: repoName,
    setStepStatusInfo,
  });

  const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
  const currentStepConfig = steps[currentStepIndex];
  const visibleStepIndex = visibleSteps.findIndex((s) => s.id === activeStep);

  const canSkipSync = repoName && !isResourceStatsLoading && shouldSkipSync;

  // A different repository is marked with instance target -- nothing will succeed
  useEffect(() => {
    if (settingsData?.items.some((item) => item.target === 'instance' && item.name !== repoName)) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('provisioning.wizard-content.error-instance-repository-exists', 'Instance repository already exists'),
        ],
      });

      navigate(PROVISIONING_URL);
    }
  }, [navigate, repoName, settingsData?.items]);

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

    // For GitHub connection step, if repo was created, show confirmation before going back
    if (activeStep === 'connection' && repoName) {
      setShowCancelConfirmation(true);
      return;
    }

    // For other steps, go back one step
    handleBack();
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    reportInteraction('grafana_provisioning_wizard_cancelled', {
      cancelledAtStep: activeStep,
      repositoryType: repoType,
    });
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

    // For GitHub connection step, show Cancel if repo was created
    if (activeStep === 'connection' && repoName) {
      return t('provisioning.wizard-content.button-cancel', 'Cancel');
    }

    return t('provisioning.wizard-content.button-previous', 'Previous');
  }, [isCancelling, shouldUseCancelBehavior, activeStep, repoName]);

  const handleNext = useCallback(async () => {
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
    setActiveStep,
    setCompletedSteps,
    setStepStatusInfo,
  ]);

  // Callback after a GH app has been created
  const handleGitHubAppSubmit = useCallback(
    (result: ConnectionCreationResult) => {
      if (result.success) {
        setValue('githubApp.connectionName', result.connectionName);
        setStepStatusInfo({ status: 'success' });
        reportInteraction('grafana_provisioning_wizard_github_app_created', { success: true });
        handleNext();
      } else {
        setStepStatusInfo({
          status: 'error',
          error: {
            title: t('provisioning.wizard.github-app-creation-failed', 'Failed to create GitHub App connection'),
            message: result.error,
          },
        });
        reportInteraction('grafana_provisioning_wizard_github_app_created', { success: false });
      }
    },
    [setValue, setStepStatusInfo, handleNext]
  );

  const onSubmit = async () => {
    if (currentStepConfig?.submitOnNext) {
      // Special handling for GitHub App step
      if (activeStep === 'githubApp') {
        const formData = getValues();
        const currentGithubAppMode = formData.githubAppMode;

        // Validate based on mode
        if (currentGithubAppMode === 'existing') {
          const isValid = await trigger('githubApp.connectionName');
          if (isValid) {
            handleNext();
          }
          return;
        } else if (currentGithubAppMode === 'new') {
          // Step handles validation and API call internally via submit()
          setIsSubmitting(true);
          try {
            await githubAppStepRef.current?.submit();
          } finally {
            setIsSubmitting(false);
          }
          return;
        }
      }

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
        const connectionName =
          formData.githubAuthType === 'github-app' ? formData.githubApp?.connectionName : undefined;
        const spec = dataToSpec(formData.repository, connectionName);
        const token = formData.githubAuthType === 'pat' ? formData.repository.token : undefined;
        const rsp = await submitData(spec, token);
        if (rsp.error) {
          if (isFetchError(rsp.error)) {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryRequestFailed,
                message: rsp.error.data.message,
              },
            });
          } else {
            setStepStatusInfo({
              status: 'error',
              error: repositoryRequestFailed,
            });
          }
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
          // Special handling for token errors on connecting step with the app flow
          // since we do not show the token field on that step
          if (field === 'repository.token' && activeStep === 'connection' && githubAuthType !== 'pat') {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: errorMessage?.message ?? '',
              },
            });
          }
          if (field && errorMessage) {
            setError(field, errorMessage);
          } else {
            setStepStatusInfo({
              status: 'error',
              error: {
                title: repositoryConnectionFailed,
                message: error.data.message,
              },
            });
          }
        } else {
          setStepStatusInfo({
            status: 'error',
            error: repositoryConnectionFailed,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Special handling for authType step - validate selection and proceed
      if (activeStep === 'authType') {
        const formData = getValues();
        if (formData.githubAuthType) {
          handleNext();
        }
        return;
      }

      // For other steps without submission, proceed if the job was successful or had warnings
      if (isStepSuccess || hasStepWarning) {
        handleNext();
      }
    }
  };

  const isNextButtonDisabled = () => {
    // AuthType step is always enabled (user just needs to select an option)
    if (activeStep === 'authType') {
      return false;
    }
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
        {activeStep === 'authType' ? (
          <div className={styles.stepperSpacer} />
        ) : (
          <>
            <Stepper steps={visibleSteps} activeStep={activeStep} visitedSteps={completedSteps} />
            <div className={styles.divider} />
          </>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <FormPrompt
            onDiscard={onDiscard}
            confirmRedirect={isDirty && !['authType', 'connection', 'finish'].includes(activeStep) && !isCancelling}
          />
          <Stack direction="column">
            <Box marginBottom={2}>
              <Text element="h2">
                {activeStep === 'authType'
                  ? currentStepConfig?.title
                  : `${visibleStepIndex + 1}. ${currentStepConfig?.title}`}
              </Text>
            </Box>

            {hasStepError && 'error' in stepStatusInfo && <ProvisioningAlert error={stepStatusInfo.error} />}
            {hasStepWarning && 'warning' in stepStatusInfo && <ProvisioningAlert warning={stepStatusInfo.warning} />}
            {isStepSuccess && 'success' in stepStatusInfo && <ProvisioningAlert success={stepStatusInfo.success} />}

            <div className={styles.content}>
              {activeStep === 'authType' && <AuthTypeStep />}
              {activeStep === 'githubApp' && <GitHubAppStep ref={githubAppStepRef} onSubmit={handleGitHubAppSubmit} />}
              {activeStep === 'connection' && <ConnectStep />}
              {activeStep === 'bootstrap' && <BootstrapStep settingsData={settingsData} repoName={repoName} />}
              {activeStep === 'synchronize' && (
                <SynchronizeStep onCancel={handleRepositoryDeletion} isCancelling={isCancelling} />
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
});

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
  stepperSpacer: css({
    width: 201, // Stepper width (200px) + divider width (1px)
  }),
  content: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(4),
    marginBottom: theme.spacing(4),
  }),
});
