import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { useGetFrontendSettingsQuery } from '../api';

import { ConnectionStep } from './ConnectionStep';
import { MigrateStep } from './MigrateStep';
import { RepositoryStep } from './RepositoryStep';
import { Stepper, Step } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Repository connection' },
  { id: 'repository', name: 'Repository configuration' },
  { id: 'migrate', name: 'Migrate dashboards' },
];

const nextButtonText = {
  connection: 'Next',
  repository: 'Next',
  migrate: 'Finish',
} as const;

export function ProvisioningWizard() {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [stepSuccess, setStepSuccess] = useState(false);
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: getDefaultValues(),
      migrate: {
        history: true,
        identifier: true, // Keep the same URLs
      },
    },
  });

  const styles = useStyles2(getStyles);

  const handleNext = async () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex < steps.length - 1) {
      if (activeStep === 'connection') {
        // Validate repository form data before proceeding
        const isValid = await methods.trigger('repository');
        if (!isValid) {
          return;
        }
      }

      if (activeStep === 'migrate') {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
      setActiveStep(steps[currentStepIndex + 1].id);
      setStepSuccess(false);
    } else if (activeStep === 'migrate') {
      settingsQuery.refetch();
      navigate('/dashboards');
    }
  };

  const handleBack = () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex > 0) {
      setActiveStep(steps[currentStepIndex - 1].id);
      setStepSuccess(true);
      // Remove the last completed step when going back
      setCompletedSteps((prev) => prev.slice(0, -1));
    }
  };

  const handleStatusChange = (success: boolean) => {
    setStepSuccess(success);
    if (success) {
      setCompletedSteps((prev) => [...prev, activeStep]);
    }
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
          {activeStep === 'repository' && <RepositoryStep onStatusChange={handleStatusChange} />}
          {activeStep === 'migrate' && <MigrateStep onStatusChange={handleStatusChange} />}
        </div>

        <Stack gap={2} justifyContent="flex-end">
          {activeStep !== 'connection' && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={(activeStep === 'repository' && !stepSuccess) || (activeStep === 'migrate' && !stepSuccess)}
          >
            {nextButtonText[activeStep]}
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
