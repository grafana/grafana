import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { getDefaultValues } from '../ConfigForm';
import { RepositorySpec } from '../api';

import { ConnectionStep } from './ConnectionStep';
import { ExportStep } from './ExportStep';
import { ProvisioningStep } from './ProvisioningStep';
import { RepositoryStep } from './RepositoryStep';
import { Stepper, Step } from './Stepper';
import { WizardFormData, WizardStep } from './types';

const steps: Array<Step<WizardStep>> = [
  { id: 'connection', name: 'Repository connection' },
  { id: 'repository', name: 'Repository configuration' },
  { id: 'export', name: 'Export dashboards' },
  { id: 'provisioning', name: 'Start provisioning' },
];

const nextButtonText = {
  connection: 'Connect to your repository',
  repository: 'Export dashboards to repository',
  export: 'Start provisioning',
  provisioning: 'Finish',
} as const;

export interface WizardProps {
  data?: RepositorySpec;
  onSubmit: (data: RepositorySpec) => void;
}

export function ProvisioningWizard({ data, onSubmit }: WizardProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: getDefaultValues(data),
      export: {
        history: true,
        identifier: false,
      },
    },
  });
  const styles = useStyles2(getStyles);

  const handleNext = async () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex < steps.length - 1) {
      if (['connection', 'repository'].includes(activeStep)) {
        // Validate repository form data before proceeding
        const isValid = await methods.trigger('repository');
        if (!isValid) {
          return;
        }
      }

      setCompletedSteps([...completedSteps, activeStep]);
      setActiveStep(steps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
    if (currentStepIndex > 0) {
      setActiveStep(steps[currentStepIndex - 1].id);
    }
  };

  const handleSubmit = (data: WizardFormData) => {
    // TODO: Redirect somewhere?
    // onSubmit();
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)} className={styles.form}>
        <Stepper
          steps={steps}
          activeStep={activeStep}
          onStepChange={() => {}}
          validationResults={{
            connection: { valid: true },
            repository: { valid: true },
            export: { valid: true },
            provisioning: { valid: true },
          }}
          getNextUrl={() => ''}
        />

        <div className={styles.content}>
          {activeStep === 'connection' && <ConnectionStep />}
          {activeStep === 'repository' && <RepositoryStep />}
          {activeStep === 'export' && <ExportStep />}
          {activeStep === 'provisioning' && <ProvisioningStep />}
        </div>

        <Stack gap={2} direction="row" justifyContent="flex-end">
          {activeStep !== 'connection' && (
            <Button type="button" variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            type={activeStep === 'provisioning' ? 'submit' : 'button'}
            onClick={activeStep === 'provisioning' ? undefined : handleNext}
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
