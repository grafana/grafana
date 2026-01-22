import { css } from '@emotion/css';
import { memo, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, ConfirmModal, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepositoryViewList, useDeleteRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { getDefaultValues } from '../Config/defaults';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';

import { GitHubAppStepRef } from './GitHubAppStep';
import { useStepStatus } from './StepStatusContext';
import { Stepper } from './Stepper';
import { WizardButtonBar } from './components/WizardButtonBar';
import { WizardStepContent } from './components/WizardStepContent';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useResourceStats } from './hooks/useResourceStats';
import { useWizardButtons } from './hooks/useWizardButtons';
import { useWizardCancellation } from './hooks/useWizardCancellation';
import { useWizardNavigation } from './hooks/useWizardNavigation';
import { useWizardSubmission } from './hooks/useWizardSubmission';
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
  const navigate = useNavigate();
  const styles = useStyles2(getStyles);

  const { stepStatusInfo, setStepStatusInfo, isStepSuccess, isStepRunning, hasStepError, hasStepWarning } =
    useStepStatus();

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
    formState: { isDirty },
    handleSubmit,
  } = methods;

  const [repoName = '', repoType, syncTarget, githubAuthType] = watch([
    'repositoryName',
    'repository.type',
    'repository.sync.target',
    'githubAuthType',
    'githubAppMode',
  ]);

  // Ref for GitHubAppStep to trigger submission
  const githubAppStepRef = useRef<GitHubAppStepRef>(null);

  const steps = useMemo(() => getSteps(repoType, githubAuthType), [repoType, githubAuthType]);
  const [submitData] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const { shouldSkipSync, isLoading: isResourceStatsLoading } = useResourceStats(repoName, syncTarget);
  const { createSyncJob, isLoading: isCreatingSkipJob } = useCreateSyncJob({
    repoName: repoName,
    setStepStatusInfo,
  });

  const canSkipSync = Boolean(repoName && !isResourceStatsLoading && shouldSkipSync);

  // Navigation hook (must be first since other hooks depend on activeStep and completedSteps)
  const { activeStep, completedSteps, currentStepConfig, visibleStepIndex, goToNextStep, goToPreviousStep } =
    useWizardNavigation({
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
    });

  // Precompute cancel behavior state (used by both cancellation and buttons hooks)
  const isSyncCompleted = activeStep === 'synchronize' && (isStepSuccess || hasStepWarning || hasStepError);
  const isFinishWithSyncCompleted =
    activeStep === 'finish' && (isStepSuccess || completedSteps.includes('synchronize'));
  const shouldUseCancelBehavior =
    activeStep === 'authType' ||
    (activeStep === 'connection' && repoType !== 'github') ||
    isSyncCompleted ||
    isFinishWithSyncCompleted;

  const {
    isCancelling,
    showCancelConfirmation,
    handlePrevious,
    handleConfirmCancel,
    handleDismissCancel,
    handleRepositoryDeletion,
    onDiscard,
  } = useWizardCancellation({
    repoName,
    repoType,
    activeStep,
    deleteRepository,
    navigate,
    handleBack: goToPreviousStep,
    shouldUseCancelBehavior,
  });

  const { isSubmitting, handleSubmit: onFormSubmit } = useWizardSubmission({
    activeStep,
    currentStepConfig,
    methods,
    submitData,
    githubAppStepRef,
    setStepStatusInfo,
    onSuccess: goToNextStep,
    setValue,
  });

  const { nextButtonText, previousButtonText, isNextDisabled, isPreviousDisabled } = useWizardButtons({
    activeStep,
    steps,
    repoName,
    canSkipSync,
    isSubmitting,
    isCancelling,
    isStepRunning,
    isStepSuccess,
    hasStepError,
    hasStepWarning,
    isCreatingSkipJob,
    showCancelConfirmation,
    shouldUseCancelBehavior,
  });

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

  // Callback after a GH app has been created
  const handleGitHubAppSubmit = (result: ConnectionCreationResult) => {
    if (result.success) {
      setValue('githubApp.connectionName', result.connectionName);
      setStepStatusInfo({ status: 'success' });
      goToNextStep();
    } else {
      setStepStatusInfo({
        status: 'error',
        error: {
          title: t('provisioning.wizard.github-app-creation-failed', 'Failed to create GitHub App connection'),
          message: result.error,
        },
      });
    }
  };

  const visibleSteps = useMemo(() => steps.filter((s) => s.id !== 'authType'), [steps]);

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
        <form onSubmit={handleSubmit(onFormSubmit)} className={styles.form}>
          <FormPrompt
            onDiscard={onDiscard}
            confirmRedirect={isDirty && !['authType', 'connection', 'finish'].includes(activeStep) && !isCancelling}
          />
          <Stack direction="column">
            <Box marginBottom={2}>
              <Text element="h2">
                {activeStep === 'authType'
                  ? (currentStepConfig?.title ?? '')
                  : `${visibleStepIndex + 1}. ${currentStepConfig?.title ?? ''}`}
              </Text>
            </Box>

            {hasStepError && 'error' in stepStatusInfo && <ProvisioningAlert error={stepStatusInfo.error} />}
            {hasStepWarning && 'warning' in stepStatusInfo && <ProvisioningAlert warning={stepStatusInfo.warning} />}
            {isStepSuccess && 'success' in stepStatusInfo && <ProvisioningAlert success={stepStatusInfo.success} />}

            <div className={styles.content}>
              <WizardStepContent
                activeStep={activeStep}
                settingsData={settingsData}
                repoName={repoName}
                githubAppStepRef={githubAppStepRef}
                onGitHubAppSubmit={handleGitHubAppSubmit}
                onRepositoryDeletion={handleRepositoryDeletion}
                isCancelling={isCancelling}
              />
            </div>

            <WizardButtonBar
              previousText={previousButtonText}
              nextText={nextButtonText}
              isPreviousDisabled={isPreviousDisabled}
              isNextDisabled={isNextDisabled}
              isSubmitting={isSubmitting}
              onPrevious={handlePrevious}
            />
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
        onDismiss={handleDismissCancel}
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

    marginBottom: theme.spacing(13), // align with the button row
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
