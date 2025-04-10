import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { t } from 'app/core/internationalization';

import { getDefaultValues } from '../Config/ConfigForm';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { StepStatus } from '../hooks/useStepStatus';
import { dataToSpec } from '../utils/data';

import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { RequestErrorAlert } from './RequestErrorAlert';
import { Step, Stepper } from './Stepper';
import { SynchronizeStep } from './SynchronizeStep';
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
      name: t('provisioning.wizard.step-synchronize', 'Synchronize'),
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

type StepStatusInfo = { status: 'idle' | 'running' | 'success' } | { status: 'error'; error: string };

export function ProvisioningWizard({ type }: { type: RepoType }) {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const [stepStatusInfo, setStepStatusInfo] = useState<StepStatusInfo>({ status: 'idle' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  const steps = getSteps();
  const styles = useStyles2(getStyles);

  const values = getDefaultValues();
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { ...values, type },
      migrate: {
        history: true,
        identifier: true, // Keep the same URLs
      },
    },
  });

  const {
    watch,
    setValue,
    getValues,
    trigger,
    formState: { isDirty },
  } = methods;

  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();

  const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
  const currentStepConfig = steps[currentStepIndex];

  const isStepSuccess = stepStatusInfo.status === 'success';

  // A different repository is marked with instance target -- nothing will succeed
  useEffect(() => {
    if (settingsQuery.data?.items.some((item) => item.target === 'instance' && item.name !== repoName)) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('provisioning.wizard-content.error-instance-repository-exists', 'Instance repository already exists'),
        ],
      });

      navigate(PROVISIONING_URL);
    }
  }, [navigate, repoName, settingsQuery.data?.items]);

  const updateStepStatus = useCallback(
    (status: StepStatus, errorMessage?: string) => {
      if (activeStep === 'connection') {
        return;
      }
      if (status === 'error' && errorMessage) {
        setStepStatusInfo({ status: 'error', error: errorMessage });
      } else if (status === 'error') {
        // Require error message for error status
        setStepStatusInfo({ status: 'error', error: 'An unexpected error occurred' });
      } else {
        setStepStatusInfo({ status });
      }

      if (status === 'success') {
        setCompletedSteps((prev) => (prev.includes(activeStep) ? prev : [...prev, activeStep]));
      }
    },
    [activeStep]
  );

  const handleRepositoryDeletion = async (name: string) => {
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

  const handleCancel = async () => {
    // For the first step, do not delete anything—just go back.
    if (activeStep === 'connection' || !repoName) {
      navigate(PROVISIONING_URL);
      return;
    }
    setIsCancelling(true);
    void handleRepositoryDeletion(repoName);
  };

  // Calculate button text based on current step position
  const getNextButtonText = useCallback(
    (currentStep: WizardStep) => {
      const stepIndex = steps.findIndex((s) => s.id === currentStep);

      // Guard against index out of bounds
      if (stepIndex === -1 || stepIndex >= steps.length - 1) {
        return t('provisioning.wizard.button-next', 'Finish');
      }

      return steps[stepIndex + 1].name;
    },
    [steps]
  );

  const handleNext = async () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    const isLastStep = currentStepIndex === steps.length - 1;

    if (activeStep === 'connection') {
      // Validate repository form data before proceeding
      const isValid = await trigger('repository');
      if (!isValid) {
        return;
      }

      // Pick a name nice name based on type+settings
      const current = getValues();
      switch (current.repository.type) {
        case 'github':
          const name = current.repository.url ?? 'github';
          setValue('repository.title', name.replace('https://github.com/', ''));
          break;
        case 'local':
          setValue('repository.title', current.repository.path ?? 'local');
          break;
      }
    }

    // Only navigate to provisioning URL if we're on the actual last step and it's completed
    if (isLastStep && isStepSuccess) {
      settingsQuery.refetch();
      navigate(PROVISIONING_URL);
      return;
    }

    // For all other cases, proceed to next step
    if (currentStepIndex < steps.length - 1) {
      setActiveStep(steps[currentStepIndex + 1].id);
      setStepStatusInfo({ status: 'idle' });
    }
  };

  const handleNextWithSubmit = async () => {
    if (currentStepConfig?.submitOnNext) {
      // Validate form data before proceeding
      if (activeStep === 'connection' || activeStep === 'bootstrap') {
        const isValid = await trigger(['repository', 'repository.title']);
        if (!isValid) {
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const formData = getValues();
        const spec = dataToSpec(formData.repository);
        const rsp = await submitData(spec);
        if (rsp.error) {
          updateStepStatus('error', 'Repository request failed');
          return;
        }

        // Fill in the k8s name from the initial POST response
        const name = rsp.data?.metadata?.name;
        if (name) {
          setValue('repositoryName', name);
          handleNext();
        } else {
          console.error('Saved repository without a name:', rsp);
        }
      } catch (error) {
        updateStepStatus('error', 'Repository connection failed');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // only proceed if the job was successful
      if (isStepSuccess) {
        handleNext();
      }
    }
  };

  const isNextButtonDisabled = () => {
    if (activeStep === 'synchronize') {
      return stepStatusInfo.status !== 'success';
    }
    return isSubmitting || isCancelling || stepStatusInfo.status === 'running' || stepStatusInfo.status === 'error';
  };

  return (
    <FormProvider {...methods}>
      <Stack gap={6} direction="row" alignItems="flex-start">
        <Stepper steps={steps} activeStep={activeStep} visitedSteps={completedSteps} />
        <div className={styles.divider} />
        <form className={styles.form}>
          <FormPrompt onDiscard={handleCancel} confirmRedirect={isDirty && activeStep !== 'finish' && !isCancelling} />
          <Stack direction="column">
            <Box marginBottom={2}>
              {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
              <Text element="h2">
                {currentStepIndex + 1}. {currentStepConfig?.title}
              </Text>
            </Box>

            <RequestErrorAlert
              request={saveRequest}
              title={t(
                'provisioning.wizard-content.title-repository-verification-failed',
                'Repository verification failed'
              )}
            />

            <div className={styles.content}>
              {activeStep === 'connection' && <ConnectStep />}
              {activeStep === 'bootstrap' && (
                <BootstrapStep
                  onOptionSelect={setRequiresMigration}
                  onStepUpdate={updateStepStatus}
                  settingsData={settingsQuery.data}
                  repoName={repoName ?? ''}
                />
              )}
              {activeStep === 'synchronize' && (
                <SynchronizeStep onStepUpdate={updateStepStatus} requiresMigration={requiresMigration} />
              )}
              {activeStep === 'finish' && <FinishStep />}
            </div>

            {stepStatusInfo.status === 'error' && <Alert severity="error" title={stepStatusInfo.error} />}

            <Stack gap={2} justifyContent="flex-end">
              <Button
                variant={stepStatusInfo.status === 'error' ? 'primary' : 'secondary'}
                onClick={handleCancel}
                disabled={isSubmitting || isCancelling}
              >
                {isCancelling
                  ? t('provisioning.wizard-content.button-cancelling', 'Cancelling...')
                  : t('provisioning.wizard-content.button-cancel', 'Cancel')}
              </Button>
              <Button onClick={handleNextWithSubmit} disabled={isNextButtonDisabled()}>
                {isSubmitting
                  ? t('provisioning.wizard-content.button-submitting', 'Submitting...')
                  : getNextButtonText(activeStep)}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Stack>
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
