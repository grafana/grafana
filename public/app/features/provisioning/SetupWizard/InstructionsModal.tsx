import React, { useState } from 'react';
import { Modal, Button, useStyles2, HorizontalGroup } from '@grafana/ui';
import { getStyles } from './styles';
import { InstructionsModalProps } from './types';
import { InstructionStepComponent } from './InstructionStepComponent';

export const InstructionsModal = ({ feature, isOpen, onDismiss }: InstructionsModalProps) => {
  const styles = useStyles2(getStyles);
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    if (currentStep < feature.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Find the first unfulfilled step
  const firstUnfulfilledStep = feature.steps.findIndex((step) => !step.fulfilled);

  // If all steps are fulfilled, start at the first step
  const initialStep = firstUnfulfilledStep === -1 ? 0 : firstUnfulfilledStep;

  // Use initialStep if currentStep is still 0 (initial render)
  React.useEffect(() => {
    if (currentStep === 0 && initialStep !== 0) {
      setCurrentStep(initialStep);
    }
  }, [currentStep, initialStep]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === feature.steps.length - 1;

  // Check if the current step is fulfilled
  const isCurrentStepFulfilled = feature.steps[currentStep]?.fulfilled;

  // Find the next unfulfilled step
  const findNextUnfulfilledStep = () => {
    for (let i = currentStep + 1; i < feature.steps.length; i++) {
      if (!feature.steps[i].fulfilled) {
        return i;
      }
    }
    return -1; // No unfulfilled steps found
  };

  const nextUnfulfilledStep = findNextUnfulfilledStep();

  // Handle skip to next unfulfilled step
  const handleSkipToNext = () => {
    if (nextUnfulfilledStep !== -1) {
      setCurrentStep(nextUnfulfilledStep);
    }
  };

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={styles.container}>
      <div className={styles.content}>
        <InstructionStepComponent
          step={feature.steps[currentStep]}
          totalSteps={currentStep + 1}
          copied={copied}
          onCopy={handleCopy}
        />
      </div>
      <div className={styles.footer}>
        <HorizontalGroup>
          <Button variant="secondary" onClick={onDismiss}>
            Close
          </Button>
          {isCurrentStepFulfilled && nextUnfulfilledStep !== -1 && (
            <Button variant="primary" onClick={handleSkipToNext}>
              Skip to Next Step
            </Button>
          )}
        </HorizontalGroup>
        <HorizontalGroup>
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={styles.buttonSecondary}
          >
            Previous
          </Button>
          <Button variant="primary" onClick={handleNext} disabled={isLastStep} className={styles.button}>
            Next
          </Button>
        </HorizontalGroup>
      </div>
    </Modal>
  );
};
