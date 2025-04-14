import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents, isFetchError } from '@grafana/runtime';
import { Alert, Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { t } from 'app/core/internationalization';

import { getDefaultValues } from '../Config/defaults';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { dataToSpec } from '../utils/data';
import { getFormErrors } from '../utils/getFormErrors';

import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { Step, Stepper } from './Stepper';
import { SynchronizeStep } from './SynchronizeStep';
import { RepoType, StepStatusInfo, WizardFormData, WizardStep } from './types';

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

  const repoName = watch('repositoryName');
  const [submitData] = useCreateOrUpdateRepository(repoName);
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
    // For the first step, do not delete anything — just go back.
    if (activeStep === 'connection' || !repoName) {
      navigate(PROVISIONING_URL);
      return;
    }
    setIsCancelling(true);
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

      return steps[stepIndex + 1].name;
    },
    [steps]
  );

  const handleNext = async () => {
    const isLastStep = currentStepIndex === steps.length - 1;

    // Only navigate to provisioning URL if we're on the actual last step
    if (isLastStep) {
      navigate(PROVISIONING_URL);
    } else {
      setActiveStep(steps[currentStepIndex + 1].id);
      setCompletedSteps((prev) => [...new Set([...prev, activeStep])]);
      setStepStatusInfo({ status: 'idle' });
    }
  };

  const onSubmit = async () => {
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
    return (
      isSubmitting ||
      isCancelling ||
      stepStatusInfo.status === 'running' ||
      (activeStep !== 'connection' && stepStatusInfo.status === 'error')
    );
  };

  return (
    <FormProvider {...methods}>
      <Stack gap={6} direction="row" alignItems="flex-start">
        <Stepper steps={steps} activeStep={activeStep} visitedSteps={completedSteps} />
        <div className={styles.divider} />
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <FormPrompt onDiscard={handleCancel} confirmRedirect={isDirty && activeStep !== 'finish' && !isCancelling} />
          <Stack direction="column">
            <Box marginBottom={2}>
              {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
              <Text element="h2">
                {currentStepIndex + 1}. {currentStepConfig?.title}
              </Text>
            </Box>

            {stepStatusInfo.status === 'error' && (
              <Alert severity="error" title={'error' in stepStatusInfo ? stepStatusInfo.error : ''} />
            )}

            <div className={styles.content}>
              {activeStep === 'connection' && <ConnectStep />}
              {activeStep === 'bootstrap' && (
                <BootstrapStep
                  onOptionSelect={setRequiresMigration}
                  onStepStatusUpdate={setStepStatusInfo}
                  settingsData={settingsQuery.data}
                  repoName={repoName ?? ''}
                />
              )}
              {activeStep === 'synchronize' && (
                <SynchronizeStep onStepStatusUpdate={setStepStatusInfo} requiresMigration={requiresMigration} />
              )}
              {activeStep === 'finish' && <FinishStep />}
            </div>

            <Stack gap={2} justifyContent="flex-end">
              <Button variant={'secondary'} onClick={handleCancel} disabled={isSubmitting || isCancelling}>
                {isCancelling
                  ? t('provisioning.wizard-content.button-cancelling', 'Cancelling...')
                  : t('provisioning.wizard-content.button-cancel', 'Cancel')}
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
