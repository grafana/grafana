import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { ConnectionStep } from './ConnectionStep';
import { MigrateStep } from './MigrateStep';
import { RepositoryStep } from './RepositoryStep';
import { Stepper, Step } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const appEvents = getAppEvents();

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Repository connection' },
  { id: 'repository', name: 'Repository configuration' },
  { id: 'migrate', name: 'Migrate dashboards' },
];

const nextButtonText = {
  connection: 'Next',
  repository: 'Connect and verify',
  migrate: 'Finish',
} as const;

export function ProvisioningWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [stepSuccess, setStepSuccess] = useState(false);
  const [submitData, request] = useCreateOrUpdateRepository();
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: getDefaultValues(),

      migrate: {
        history: true,
        identifier: false,
      },
    },
  });

  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (request.isSuccess) {
      if (request.data?.metadata?.name) {
        methods.setValue('repositoryName', request.data.metadata.name);
      }
      if (activeStep === 'repository') {
        appEvents.publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Repository settings saved'],
        });

        const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
        if (currentStepIndex < steps.length - 1) {
          setCompletedSteps((prev) => [...prev, activeStep]);
          setActiveStep(steps[currentStepIndex + 1].id);
        }
      }
    } else if (request.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to save repository settings', request.error],
      });
    }
  }, [request.isSuccess, request.isError, request.data, request.error, activeStep, methods]);

  const handleNext = async () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex < steps.length - 1) {
      if (['connection', 'repository'].includes(activeStep)) {
        // Validate repository form data before proceeding
        const isValid = await methods.trigger('repository');
        if (!isValid) {
          return;
        }

        if (activeStep === 'repository') {
          const formData = methods.getValues();
          await submitData(dataToSpec(formData.repository));
          return;
        }
      }

      if (activeStep === 'migrate') {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
      setActiveStep(steps[currentStepIndex + 1].id);
      setStepSuccess(false);
    } else if (activeStep === 'migrate') {
      navigate('/dashboards');
    }
  };

  const handleBack = () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex > 0) {
      setActiveStep(steps[currentStepIndex - 1].id);
      setStepSuccess(false);
      // Remove the last completed step when going back
      setCompletedSteps((prev) => prev.slice(0, -1));
    }
  };

  const getButtonText = () => {
    if (activeStep === 'repository' && request.isLoading) {
      return 'Connecting...';
    }
    return nextButtonText[activeStep];
  };

  return (
    <FormProvider {...methods}>
      <form className={styles.form}>
        <Stepper
          steps={steps}
          activeStep={activeStep}
          visitedSteps={completedSteps}
          validationResults={{
            connection: { valid: true },
            repository: { valid: true },
            migrate: { valid: true },
          }}
        />

        <div className={styles.content}>
          {activeStep === 'connection' && <ConnectionStep />}
          {activeStep === 'repository' && <RepositoryStep request={request} />}
          {activeStep === 'migrate' && <MigrateStep onMigrationStatusChange={setStepSuccess} />}
        </div>

        <Stack gap={2} justifyContent="flex-end">
          {activeStep !== 'connection' && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={
              request.isLoading ||
              (activeStep === 'repository' && (request.isLoading || request.isError)) ||
              (activeStep === 'migrate' && (!stepSuccess || request.isLoading))
            }
            icon={request.isLoading ? 'spinner' : undefined}
          >
            {getButtonText()}
          </Button>
        </Stack>
      </form>
    </FormProvider>
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
