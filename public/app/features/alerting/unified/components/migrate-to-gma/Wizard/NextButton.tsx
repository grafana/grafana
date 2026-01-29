import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useStepperState } from './StepperState';
import { getNextStep, isLastStep } from './constants';

interface NextButtonProps {
  /** Handler called when clicking next - should return true to proceed */
  onNext: () => boolean | Promise<boolean>;
  /** Whether this step can be skipped */
  canSkip?: boolean;
  /** Custom label for skip button */
  skipLabel?: string;
  /** Handler called when skip is clicked */
  onSkip?: () => void;
  /** Disable the next button */
  disabled?: boolean;
}

/**
 * NextButton - navigation button to proceed to the next step
 * Shows the next step name or "Submit" on the last step
 */
export const NextButton = ({ onNext, canSkip, skipLabel, onSkip, disabled }: NextButtonProps) => {
  const { activeStep, setActiveStep } = useStepperState();
  const nextStep = getNextStep(activeStep);
  const isLast = isLastStep(activeStep);

  const handleClick = async () => {
    const shouldProceed = await onNext();
    if (shouldProceed && nextStep) {
      setActiveStep(nextStep.id);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };

  // Don't render on the last step - the step content handles submission
  if (isLast || !nextStep) {
    return null;
  }

  return (
    <Stack direction="row" gap={1}>
      {canSkip && (
        <Button variant="secondary" onClick={handleSkip} data-testid="wizard-skip-button">
          {skipLabel || t('alerting.migrate-to-gma.wizard.skip', 'Skip')}
        </Button>
      )}
      <Button
        variant="primary"
        icon="arrow-right"
        onClick={handleClick}
        disabled={disabled}
        data-testid="wizard-next-button"
      >
        {nextStep.name}
      </Button>
    </Stack>
  );
};
