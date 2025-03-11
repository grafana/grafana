import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks';
import { StepStatus } from '../hooks/useStepStatus';
import { dataToSpec } from '../utils/data';

import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { MigrateStep } from './MigrateStep';
import { PullStep } from './PullStep';
import { RequestErrorAlert } from './RequestErrorAlert';
import { Step, Stepper } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Connect', title: 'Connect to repository', submitOnNext: true },
  { id: 'bootstrap', name: 'Bootstrap', title: 'Bootstrap repository', submitOnNext: true },
  { id: 'migrate', name: 'Resources', title: 'Migrate resources', submitOnNext: false },
  { id: 'pull', name: 'Resources', title: 'Pull resources', submitOnNext: false },
  { id: 'finish', name: 'Finish', title: 'Finish setup', submitOnNext: true },
];

export function ProvisioningWizard() {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [stepSuccess, setStepSuccess] = useState(false);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  const values = getDefaultValues();

  // Disable sync at the start of the wizard
  values.sync.enabled = false;
  // HACK: Set folder as default for now as instance will block
  values.sync.target = 'folder';

  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: values,
      migrate: {
        history: true,
        identifier: true, // Keep the same URLs
      },
    },
  });

  const styles = useStyles2(getStyles);

  const handleStatusChange = useCallback(
    (success: boolean) => {
      setStepSuccess(success);
      if (success) {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
    },
    [activeStep]
  );

  // Filter out migrate step if using legacy storage
  const availableSteps = useMemo(() => {
    return requiresMigration
      ? steps.filter((step) => step.id !== 'pull')
      : steps.filter((step) => step.id !== 'migrate');
  }, [requiresMigration]);

  // Calculate button text based on current step position
  const getNextButtonText = (currentStep: WizardStep) => {
    const stepIndex = availableSteps.findIndex((s) => s.id === currentStep);
    if (currentStep === 'bootstrap') {
      return 'Start';
    }
    return stepIndex === availableSteps.length - 1 ? 'Finish' : 'Next';
  };

  const handleNext = async () => {
    // Call verify if must
    const currentStepIndex = availableSteps.findIndex((s) => s.id === activeStep);
    const isLastStep = currentStepIndex === availableSteps.length - 1;
    if (currentStepIndex < availableSteps.length - 1) {
      if (activeStep === 'connection') {
        // Validate repository form data before proceeding
        const isValid = await methods.trigger('repository');
        if (!isValid) {
          return;
        }
      }

      // If we're on the bootstrap step, determine the next step based on the migration flag
      if (activeStep === 'bootstrap') {
        setActiveStep(requiresMigration ? 'migrate' : 'pull');
        return;
      }

      // If we're on the last step, mark it as completed
      if (isLastStep) {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
      setActiveStep(availableSteps[currentStepIndex + 1].id);
      setStepSuccess(false);
    } else if (isLastStep) {
      settingsQuery.refetch();
      navigate(PROVISIONING_URL);
    }
  };

  return (
    <FormProvider {...methods}>
      <WizardContent
        activeStep={activeStep}
        completedSteps={completedSteps}
        availableSteps={availableSteps}
        requiresMigration={requiresMigration}
        handleStatusChange={handleStatusChange}
        handleNext={handleNext}
        getNextButtonText={getNextButtonText}
        styles={styles}
        onOptionSelect={setRequiresMigration}
        stepSuccess={stepSuccess}
      />
    </FormProvider>
  );
}

function WizardContent({
  activeStep,
  completedSteps,
  availableSteps,
  requiresMigration,
  handleStatusChange,
  handleNext,
  getNextButtonText,
  styles,
  onOptionSelect,
  stepSuccess,
}: {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  availableSteps: Array<Step<WizardStep>>;
  requiresMigration: boolean;
  handleStatusChange: (success: boolean) => void;
  handleNext: () => void;
  getNextButtonText: (step: WizardStep) => string;
  styles: any;
  onOptionSelect: (requiresMigration: boolean) => void;
  stepSuccess: boolean;
}) {
  const { watch, setValue, getValues, trigger } = useFormContext<WizardFormData>();
  const navigate = useNavigate();
  const appEvents = getAppEvents();

  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [stepStatus, setStepStatus] = useState<StepStatus>('idle');
  const [stepError, setStepError] = useState<string | undefined>();

  const handleStepUpdate = useCallback((status: StepStatus, error?: string) => {
    setStepStatus(status);
    setStepError(error);
  }, []);

  const handleJobRunningChange = (isRunning: boolean) => {
    setIsJobRunning(isRunning);
  };

  const handleJobStatusChange = (success: boolean) => {
    handleStatusChange(success);
    setHasError(!success);
  };

  const handleJobErrorChange = (error: string | null) => {
    setHasError(!!error);
  };

  const handleCancel = async () => {
    if (activeStep === 'connection') {
      navigate(PROVISIONING_URL);
      return;
    }

    if (!repoName) {
      navigate(PROVISIONING_URL);
      return;
    }

    setIsCancelling(true);
    try {
      // Delete repository if we're past the first step
      await deleteRepository({ name: repoName });
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Repository deleted'],
      });

      // Wait before redirecting to ensure deletion is indexed
      setTimeout(() => {
        navigate(PROVISIONING_URL);
      }, 1500);
      navigate(PROVISIONING_URL);
    } catch (error) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to delete repository. Please try again.'],
      });
      setIsCancelling(false);
    }
  };

  const handleNextWithSubmit = async () => {
    const currentStep = availableSteps.find((s) => s.id === activeStep);
    if (currentStep?.submitOnNext) {
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
        await submitData(spec);
        // Don't navigate here - let the useEffect handle it
      } catch (error) {
        console.error('Repository connection failed:', error);
        handleStatusChange(false);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // For job steps, only proceed if the job was successful
      if (isJobStep(activeStep)) {
        if (stepSuccess && !isJobRunning) {
          handleNext();
        }
      } else {
        // For other non-submit steps, proceed normally
        handleNext();
      }
    }
  };

  useEffect(() => {
    const appEvents = getAppEvents();
    if (saveRequest.isSuccess) {
      if (saveRequest.data?.metadata?.name) {
        setValue('repositoryName', saveRequest.data.metadata.name);
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Repository saved'],
        });
        // Move to next step after successful save
        handleStatusChange(true);
        handleNext();
      }
    } else if (saveRequest.isError) {
      handleStatusChange(false);
    }
  }, [saveRequest.isSuccess, saveRequest.isError, saveRequest.data, setValue, handleStatusChange, handleNext]);

  // Helper to check if current step needs job status
  const isJobStep = (step: string) => {
    return step === 'migrate' || step === 'pull';
  };

  // Determine if the next button should be disabled
  const isNextButtonDisabled = () => {
    if (isSubmitting || isCancelling) {
      return true;
    }

    if (isJobStep(activeStep)) {
      return stepStatus === 'running' || stepStatus === 'error';
    }

    return false;
  };

  return (
    <form className={styles.form}>
      <Stepper
        steps={availableSteps}
        activeStep={activeStep}
        visitedSteps={completedSteps}
        validationResults={{
          connection: { valid: true },
          bootstrap: { valid: true },
          migrate: { valid: true },
          pull: { valid: true },
          finish: { valid: true },
        }}
      />
      <Box marginBottom={2}>
        <Text element="h2">
          {availableSteps.findIndex((step) => step.id === activeStep) + 1}.{' '}
          {availableSteps.find((step) => step.id === activeStep)?.title}
        </Text>
      </Box>
      <RequestErrorAlert request={saveRequest} title="Repository verification failed" />
      <div className={styles.content}>
        {activeStep === 'connection' && <ConnectStep />}
        {activeStep === 'bootstrap' && (
          <BootstrapStep
            onOptionSelect={onOptionSelect}
            onStatusChange={handleJobStatusChange}
            onRunningChange={handleJobRunningChange}
            onErrorChange={handleJobErrorChange}
          />
        )}
        {activeStep === 'migrate' && requiresMigration && <MigrateStep onStepUpdate={handleStepUpdate} />}
        {activeStep === 'pull' && !requiresMigration && <PullStep onStepUpdate={handleStepUpdate} />}
        {activeStep === 'finish' && <FinishStep />}
      </div>

      {stepError && <Alert severity="error" title={stepError} />}

      <Stack gap={2} justifyContent="flex-end">
        <Button
          variant={hasError ? 'primary' : 'secondary'}
          onClick={handleCancel}
          disabled={isSubmitting || isCancelling}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </Button>
        <Button onClick={handleNextWithSubmit} disabled={isNextButtonDisabled()}>
          {isSubmitting ? 'Submitting...' : getNextButtonText(activeStep)}
        </Button>
      </Stack>
    </form>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    maxWidth: '900px',
  }),
  content: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(4),
    marginBottom: theme.spacing(4),
  }),
});
