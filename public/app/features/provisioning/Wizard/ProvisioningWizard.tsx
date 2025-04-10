import { useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { getDefaultValues } from '../Config/ConfigForm';
import { PROVISIONING_URL } from '../constants';

import { Step } from './Stepper';
import { WizardContent } from './WizardContent';
import { RepoType, WizardFormData, WizardStep } from './types';

export function ProvisioningWizard({ type }: { type: RepoType }) {
  const [activeStep, setActiveStep] = useState<WizardStep>('connection');
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [stepSuccess, setStepSuccess] = useState(false);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  const values = getDefaultValues();

  const steps = useMemo<Array<Step<WizardStep>>>(
    () => [
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
    ],
    []
  );

  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { ...values, type },
      migrate: {
        history: true,
        identifier: true, // Keep the same URLs
      },
    },
  });

  const handleStatusChange = useCallback(
    (success: boolean) => {
      setStepSuccess(success);
      if (success) {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
    },
    [activeStep]
  );

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
      const isValid = await methods.trigger('repository');
      if (!isValid) {
        return;
      }

      // Pick a name nice name based on type+settings
      const current = methods.getValues();
      switch (current.repository.type) {
        case 'github':
          const name = current.repository.url ?? 'github';
          methods.setValue('repository.title', name.replace('https://github.com/', ''));
          break;
        case 'local':
          methods.setValue('repository.title', current.repository.path ?? 'local');
          break;
      }
    }

    // Only navigate to provisioning URL if we're on the actual last step and it's completed
    if (isLastStep && stepSuccess) {
      settingsQuery.refetch();
      navigate(PROVISIONING_URL);
      return;
    }

    // For all other cases, proceed to next step
    if (currentStepIndex < steps.length - 1) {
      setActiveStep(steps[currentStepIndex + 1].id);
      setStepSuccess(false);
      // Update completed steps only if the current step was successful
      if (stepSuccess) {
        setCompletedSteps((prev) => [...prev, activeStep]);
      }
    }
  };

  return (
    <FormProvider {...methods}>
      <WizardContent
        activeStep={activeStep}
        completedSteps={completedSteps}
        availableSteps={steps}
        requiresMigration={requiresMigration}
        handleStatusChange={handleStatusChange}
        handleNext={handleNext}
        getNextButtonText={getNextButtonText}
        onOptionSelect={setRequiresMigration}
        stepSuccess={stepSuccess}
        settingsData={settingsQuery.data}
      />
    </FormProvider>
  );
}
