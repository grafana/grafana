import { css } from '@emotion/css';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { BootstrapStep } from './BootstrapStep';
import { ConnectStep } from './ConnectStep';
import { FinishStep } from './FinishStep';
import { MigrateStep } from './MigrateStep';
import { PullStep } from './PullStep';
import { RequestErrorAlert } from './RequestErrorAlert';
import { Stepper, Step } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Connect', submitOnNext: true },
  { id: 'bootstrap', name: 'Bootstrap', submitOnNext: true },
  { id: 'migrate', name: 'Resources', submitOnNext: false },
  { id: 'pull', name: 'Resources', submitOnNext: false },
  { id: 'finish', name: 'Finish', submitOnNext: true },
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

  const handleBack = () => {
    const currentStepIndex = availableSteps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex > 0) {
      setActiveStep(availableSteps[currentStepIndex - 1].id);
      setStepSuccess(true);
      // Remove the last completed step when going back
      setCompletedSteps((prev) => prev.slice(0, -1));
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
        handleBack={handleBack}
        getNextButtonText={getNextButtonText}
        styles={styles}
        onOptionSelect={setRequiresMigration}
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
  handleBack,
  getNextButtonText,
  styles,
  onOptionSelect,
}: {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  availableSteps: Array<Step<WizardStep>>;
  requiresMigration: boolean;
  handleStatusChange: (success: boolean) => void;
  handleNext: () => void;
  handleBack: () => void;
  getNextButtonText: (step: WizardStep) => string;
  styles: any;
  onOptionSelect: (requiresMigration: boolean) => void;
}) {
  const { watch, setValue, getValues, trigger } = useFormContext<WizardFormData>();
  const navigate = useNavigate();

  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // Only proceed if submission was successful
        if (!saveRequest.isError) {
          handleStatusChange(true);
          handleNext();
        }
      } catch (error) {
        console.error('Repository connection failed:', error);
        handleStatusChange(false);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      handleStatusChange(true);
      handleNext();
    }
  };

  useEffect(() => {
    const appEvents = getAppEvents();
    if (saveRequest.isSuccess) {
      if (saveRequest.data?.metadata?.name) {
        setValue('repositoryName', saveRequest.data.metadata.name);
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Repository connected successfully'],
        });
      }
    } else if (saveRequest.isError) {
      handleStatusChange(false);
    }
  }, [saveRequest.isSuccess, saveRequest.isError, saveRequest.data, setValue, handleStatusChange]);

  return (
    <form className={styles.form}>
      <Stepper
        steps={availableSteps}
        activeStep={activeStep}
        visitedSteps={completedSteps}
        validationResults={{
          connection: { valid: true },
          bootstrap: { valid: true },
          repository: { valid: true },
          migrate: { valid: true },
          pull: { valid: true },
          finish: { valid: true },
        }}
      />
      <RequestErrorAlert request={saveRequest} title="Repository verification failed" />
      <div className={styles.content}>
        {activeStep === 'connection' && <ConnectStep />}
        {activeStep === 'bootstrap' && <BootstrapStep onOptionSelect={onOptionSelect} />}
        {activeStep === 'repository' && <ConnectStep />}
        {activeStep === 'migrate' && requiresMigration && <MigrateStep onStatusChange={handleStatusChange} />}
        {activeStep === 'pull' && !requiresMigration && <PullStep onStatusChange={handleStatusChange} />}
        {activeStep === 'finish' && <FinishStep onStatusChange={handleStatusChange} />}
      </div>

      <Stack gap={2} justifyContent="flex-end">
        {saveRequest.isError ? (
          <Button
            variant="destructive"
            onClick={() => {
              if (activeStep === 'connection') {
                // Just cancel if we're on the first step
                handleBack();
              } else {
                // Delete repository if we're on a later step
                if (repoName) {
                  const [deleteRepository] = useDeleteRepositoryMutation();
                  deleteRepository({ name: repoName });
                }
                handleBack();
              }
            }}
            disabled={isSubmitting}
          >
            Abort
          </Button>
        ) : (
          <>
            {activeStep !== 'connection' ? (
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
                Back
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => navigate(PROVISIONING_URL)} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleNextWithSubmit}
              disabled={
                isSubmitting ||
                (activeStep === 'migrate' && !saveRequest.isSuccess) ||
                (activeStep === 'pull' && !saveRequest.isSuccess) ||
                (activeStep === 'finish' && !saveRequest.isSuccess)
              }
            >
              {isSubmitting ? 'Submitting...' : getNextButtonText(activeStep)}
            </Button>
          </>
        )}
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
