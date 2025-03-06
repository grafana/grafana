import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { ConnectionStep } from './ConnectionStep';
import { MigrateStep } from './MigrateStep';
import { PullStep } from './PullStep';
import { RepositoryStep } from './RepositoryStep';
import { Stepper, Step } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Repository connection' },
  { id: 'repository', name: 'Repository configuration' },
  { id: 'migrate', name: 'Migrate dashboards' },
  { id: 'pull', name: 'Pull dashboards' },
];

type Props = {
  requiresMigration: boolean;
};

export function ProvisioningWizard({ requiresMigration }: Props) {
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

  // Filter out migrate step if using legacy storage
  const availableSteps = requiresMigration
    ? steps.filter((step) => step.id !== 'pull')
    : steps.filter((step) => step.id !== 'migrate');

  // Calculate button text based on current step position
  const getNextButtonText = (currentStep: WizardStep) => {
    const stepIndex = availableSteps.findIndex((s) => s.id === currentStep);
    return stepIndex === availableSteps.length - 1 ? 'Finish' : 'Next';
  };

  const handleNext = async () => {
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

      // If we're on the last step, mark it as completed
      const isLastStep = currentStepIndex === availableSteps.length - 1;
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
          steps={availableSteps}
          activeStep={activeStep}
          visitedSteps={completedSteps}
          validationResults={{
            connection: { valid: true },
            repository: { valid: true },
            migrate: { valid: true },
            pull: { valid: true },
          }}
        />

        <div className={styles.content}>
          {activeStep === 'connection' && <ConnectionStep targetSelectable={!requiresMigration} />}
          {activeStep === 'repository' && <RepositoryStep onStatusChange={handleStatusChange} />}
          {activeStep === 'migrate' && requiresMigration && <MigrateStep onStatusChange={handleStatusChange} />}
          {activeStep === 'pull' && !requiresMigration && <PullStep onStatusChange={handleStatusChange} />}
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
              (activeStep === 'repository' && !stepSuccess) ||
              (activeStep === 'migrate' && !stepSuccess) ||
              (activeStep === 'pull' && !stepSuccess)
            }
          >
            {getNextButtonText(activeStep)}
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
