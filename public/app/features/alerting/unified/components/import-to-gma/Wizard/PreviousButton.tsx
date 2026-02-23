import { Button } from '@grafana/ui';

import { useStepperState } from './StepperState';
import { getPreviousStep, isFirstStep } from './constants';

interface PreviousButtonProps {
  /** Handler called when clicking back */
  onBack?: () => void;
}

/**
 * PreviousButton - navigation button to go back to the previous step
 * Hidden on the first step
 */
export const PreviousButton = ({ onBack }: PreviousButtonProps) => {
  const { activeStep, setActiveStep, setVisitedStep } = useStepperState();
  const previousStep = getPreviousStep(activeStep);
  const isFirst = isFirstStep(activeStep);

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
  if (isFirst || !previousStep) {
    return null;
  }

  return (
    <Button variant="secondary" icon="arrow-left" onClick={handleClick} data-testid="wizard-prev-button">
      {previousStep.name}
    </Button>
  );
};
