import { useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { getDefaultValues } from '../Config/ConfigForm';
import { PROVISIONING_URL } from '../constants';

import { Step } from './Stepper';
import { WizardContent } from './WizardContent';
import { WizardFormData, WizardStep } from './types';

export function ProvisioningWizard() {
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
        name: t('provisioning.wizard.step-bootstrap', 'Bootstrap'),
        title: t('provisioning.wizard.title-bootstrap', 'Bootstrap repository'),
        submitOnNext: true,
      },
      {
        id: 'migrate',
        name: t('provisioning.wizard.step-resources', 'Resources'),
        title: t('provisioning.wizard.title-migrate', 'Migrate resources'),
        submitOnNext: false,
      },
      {
        id: 'pull',
        name: t('provisioning.wizard.step-resources', 'Resources'),
        title: t('provisioning.wizard.title-pull', 'Pull resources'),
        submitOnNext: false,
      },
      {
        id: 'finish',
        name: t('provisioning.wizard.step-finish', 'Finish'),
        title: t('provisioning.wizard.title-finish', 'Finish setup'),
        submitOnNext: true,
      },
    ],
    []
  );

  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: values,
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

  // Filter out migrate step if using legacy storage
  const availableSteps = useMemo(() => {
    return requiresMigration
      ? steps.filter((step) => step.id !== 'pull')
      : steps.filter((step) => step.id !== 'migrate');
  }, [requiresMigration, steps]);

  // Calculate button text based on current step position
  const getNextButtonText = useCallback(
    (currentStep: WizardStep) => {
      const stepIndex = availableSteps.findIndex((s) => s.id === currentStep);
      if (currentStep === 'bootstrap') {
        return t('provisioning.wizard.button-start', 'Start');
      }
      return stepIndex === availableSteps.length - 1
        ? t('provisioning.wizard.button-finish', 'Finish')
        : t('provisioning.wizard.button-next', 'Next');
    },
    [availableSteps]
  );

  const handleNext = async () => {
    const currentStepIndex = availableSteps.findIndex((s) => s.id === activeStep);
    const isLastStep = currentStepIndex === availableSteps.length - 1;

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
          methods.setValue('repository.title', name.replace('https://github/', ''));
          break;
        case 'local':
          methods.setValue('repository.title', current.repository.path ?? 'local');
          break;
      }
    }

    // If we're on the bootstrap step, determine the next step based on the migration flag
    if (activeStep === 'bootstrap') {
      const nextStep = requiresMigration ? 'migrate' : 'pull';
      setActiveStep(nextStep);
      return;
    }

    // Only navigate to provisioning URL if we're on the actual last step and it's completed
    if (isLastStep && stepSuccess) {
      settingsQuery.refetch();
      navigate(PROVISIONING_URL);
      return;
    }

    // For all other cases, proceed to next step
    if (currentStepIndex < availableSteps.length - 1) {
      setActiveStep(availableSteps[currentStepIndex + 1].id);
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
        availableSteps={availableSteps}
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
