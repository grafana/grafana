import { Button } from '@grafana/ui';

import { useStepperState } from './StepperState';
import { getPreviousStep } from './steps';

interface PreviousButtonProps {
  /** Handler called when clicking back */
  onBack?: () => void;
}

/**
 * PreviousButton - navigation button to go back to the previous step
 * Hidden on the first step
 */
export const PreviousButton = ({ onBack }: PreviousButtonProps) => {
  const { steps, activeStep, setActiveStep, setVisitedStep } = useStepperState();
  const previousStep = getPreviousStep(activeStep, steps);

  const handleClick = () => {
    if (onBack) {
      onBack();
    }
    setVisitedStep(activeStep);
    if (previousStep) {
      setActiveStep(previousStep.id);
    }
  };

  // Don't render on the first step
  if (!previousStep) {
    return null;
  }

  return (
    <Button variant="secondary" icon="arrow-left" onClick={handleClick} data-testid="wizard-prev-button">
      {previousStep.name}
    </Button>
  );
};
