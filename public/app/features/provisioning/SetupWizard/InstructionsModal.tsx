import { useState, useEffect } from 'react';
import { Modal, Button, useStyles2, Stack } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { FeatureInfo } from './types';
import { InstructionStepComponent } from './InstructionStepComponent';
import { InstructionsSidebar } from './InstructionsSidebar';

export interface Props {
  feature: FeatureInfo;
  isOpen: boolean;
  onDismiss: () => void;
}

export const InstructionsModal = ({ feature, isOpen, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);
  const [currentStep, setCurrentStep] = useState(0);

  // Find the first unfulfilled step
  const firstUnfulfilledStep = feature.steps.findIndex((step) => !step.fulfilled);
  const initialStep = firstUnfulfilledStep === -1 ? 0 : firstUnfulfilledStep;

  // Use initialStep if currentStep is still 0 (initial render)
  useEffect(() => {
    if (currentStep === 0 && initialStep !== 0) {
      setCurrentStep(initialStep);
    }
  }, [currentStep, initialStep]);

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

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === feature.steps.length - 1;
  const currentStepData = feature.steps[currentStep];
  const sideBarSteps = feature.steps.map((step) => step.title);

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={styles.modal}>
      <Stack direction="row" height="100%">
        <InstructionsSidebar steps={sideBarSteps} currentStep={currentStep} onStepClick={setCurrentStep} />

        <div className={styles.contentWrapper}>
          <InstructionStepComponent step={currentStepData} />
        </div>
      </Stack>

      <div className={styles.footer}>
        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Button variant="secondary" onClick={handlePrevious} disabled={isFirstStep}>
            Previous
          </Button>

          {isLastStep ? (
            <Button variant="primary" onClick={onDismiss} icon="check-circle">
              Done
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNext}>
              Next
            </Button>
          )}
        </Stack>
      </div>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 1100px;
    max-width: 95%;
  `,
  contentWrapper: css`
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  `,
  footer: css`
    padding: ${theme.spacing(2)};
    border-top: 1px solid ${theme.colors.border.medium};
  `,
});
