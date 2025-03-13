import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { RepositoryViewList, useDeleteRepositoryMutation, useGetFrontendSettingsQuery } from '../api';
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

export function WizardContent({
  activeStep,
  completedSteps,
  availableSteps,
  requiresMigration,
  handleStatusChange,
  handleNext,
  getNextButtonText,
  onOptionSelect,
  stepSuccess,
  settingsData,
}: {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  availableSteps: Array<Step<WizardStep>>;
  requiresMigration: boolean;
  handleStatusChange: (success: boolean) => void;
  handleNext: () => void;
  getNextButtonText: (step: WizardStep) => string;
  onOptionSelect: (requiresMigration: boolean) => void;
  stepSuccess: boolean;
  settingsData: RepositoryViewList | undefined;
}) {
  const { watch, setValue, getValues, trigger } = useFormContext<WizardFormData>();
  const navigate = useNavigate();
  const appEvents = getAppEvents();

  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const settingsQuery = useGetFrontendSettingsQuery();

  const [stepStatus, setStepStatus] = useState<StepStatus>('idle');
  const [stepError, setStepError] = useState<string | undefined>();
  const styles = useStyles2(getStyles);

  const handleStepUpdate = useCallback((status: StepStatus, error?: string) => {
    setStepStatus(status);
    setStepError(error);
  }, []);

  // A different repository is marked with instance target -- nothing will succede
  if (settingsQuery.data?.items.some((item) => item.target === 'instance' && item.name !== repoName)) {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: ['Instance repository already exists'],
    });
    if (repoName) {
      console.warn('should we delete the pending repo?', repoName);
    }
    navigate(PROVISIONING_URL);
    return;
  }

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
        const rsp = await submitData(spec);
        if (rsp.error) {
          console.log('Error (will be rendered inline)', rsp);
          return;
        }

        // Fill in the k8s name from the initial POST response
        const name = rsp.data?.metadata?.name;
        if (name?.length) {
          setValue('repositoryName', name);
          handleNext(); // Navigate after successful save
        } else {
          console.error('Saved without a name', rsp);
        }
      } catch (error) {
        console.error('Repository connection failed:', error);
        handleStatusChange(false);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // only proceed if the job was successful
      if (stepSuccess || stepStatus === 'success') {
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
        handleStatusChange(true);
      }
    } else if (saveRequest.isError) {
      handleStatusChange(false);
    }
  }, [saveRequest.isSuccess, saveRequest.isError, saveRequest.data, setValue, handleStatusChange]);

  const isNextButtonDisabled = () => {
    if (isSubmitting || isCancelling || stepStatus === 'running' || stepStatus === 'error') {
      return true;
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
            onStepUpdate={handleStepUpdate}
            settingsData={settingsData}
            repoName={repoName!}
          />
        )}
        {activeStep === 'migrate' && requiresMigration && <MigrateStep onStepUpdate={handleStepUpdate} />}
        {activeStep === 'pull' && !requiresMigration && <PullStep onStepUpdate={handleStepUpdate} />}
        {activeStep === 'finish' && <FinishStep />}
      </div>

      {stepError && <Alert severity="error" title={stepError} />}

      <Stack gap={2} justifyContent="flex-end">
        <Button
          variant={stepStatus === 'error' ? 'primary' : 'secondary'}
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
