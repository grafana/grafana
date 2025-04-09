import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import {
  RepositoryViewList,
  useDeleteRepositoryMutation,
  useGetFrontendSettingsQuery,
} from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { PROVISIONING_URL } from '../constants';
import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
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

const appEvents = getAppEvents();

interface WizardContentProps {
  activeStep: WizardStep;
  completedSteps: WizardStep[];
  availableSteps: Array<Step<WizardStep>>;
  requiresMigration: boolean;
  handleStatusChange: (success: boolean) => void;
  handleNext: () => void;
  getNextButtonText: (step: WizardStep) => string;
  onOptionSelect: (requiresMigration: boolean) => void;
  stepSuccess: boolean;
  settingsData?: RepositoryViewList;
}

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
}: WizardContentProps) {
  const { watch, setValue, getValues, trigger } = useFormContext<WizardFormData>();
  const navigate = useNavigate();

  const repoName = watch('repositoryName');
  const [submitData, saveRequest] = useCreateOrUpdateRepository(repoName);
  const [deleteRepository] = useDeleteRepositoryMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [stepStatus, setStepStatus] = useState<StepStatus>('idle');
  const [stepError, setStepError] = useState<string | undefined>();

  const styles = useStyles2(getStyles);
  const settingsQuery = useGetFrontendSettingsQuery();

  const currentStep = availableSteps.find((s) => s.id === activeStep);
  const currentStepIndex = availableSteps.findIndex((s) => s.id === activeStep);

  const handleStepUpdate = useCallback((status: StepStatus, error?: string) => {
    setStepStatus(status);
    setStepError(error);
  }, []);

  // A different repository is marked with instance target -- nothing will succeed
  if (settingsQuery.data?.items.some((item) => item.target === 'instance' && item.name !== repoName)) {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: [
        t('provisioning.wizard-content.error-instance-repository-exists', 'Instance repository already exists'),
      ],
    });
    if (repoName) {
      console.warn('Should we delete the pending repo?', repoName);
    }
    navigate(PROVISIONING_URL);
    return null;
  }

  const handleRepositoryDeletion = async (name: string) => {
    try {
      await deleteRepository({ name });
      // Wait before redirecting to ensure deletion is processed
      setTimeout(() => {
        settingsQuery.refetch();
        navigate(PROVISIONING_URL);
      }, 1500);
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

  const handleNextWithSubmit = async () => {
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
          // Error is displayed in <RequestErrorAlert/>
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
    if (saveRequest.isSuccess) {
      const newName = saveRequest.data?.metadata?.name;
      if (newName) {
        setValue('repositoryName', newName);
        handleStatusChange(true);
      }
    } else if (saveRequest.isError) {
      handleStatusChange(false);
    }
  }, [saveRequest, setValue, handleStatusChange]);

  const isNextButtonDisabled = () => {
    return isSubmitting || isCancelling || stepStatus === 'running' || stepStatus === 'error';
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
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <Text element="h2">
          {currentStepIndex + 1}. {currentStep?.title}
        </Text>
      </Box>

      <RequestErrorAlert
        request={saveRequest}
        title={t('provisioning.wizard-content.title-repository-verification-failed', 'Repository verification failed')}
      />

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
