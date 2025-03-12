import { useCallback, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { getDefaultValues } from '../ConfigForm';
import { useGetFrontendSettingsQuery } from '../api';
import { PROVISIONING_URL } from '../constants';

import { Step } from './Stepper';
import { WizardContent } from './WizardContent';
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
        onOptionSelect={setRequiresMigration}
        stepSuccess={stepSuccess}
      />
    </FormProvider>
  );
}
