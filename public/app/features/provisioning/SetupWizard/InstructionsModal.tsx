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

  // Initialize to the first unfulfilled step or 0
  const initialStepIndex = feature.steps.findIndex((step) => !step.fulfilled);
  const [currentStep, setCurrentStep] = useState(initialStepIndex === -1 ? 0 : initialStepIndex);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === feature.steps.length - 1;
  const stepTitles = feature.steps.map((step) => step.title);

  const handleNext = () => !isLastStep && setCurrentStep(currentStep + 1);
  const handlePrevious = () => !isFirstStep && setCurrentStep(currentStep - 1);

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={styles.modal}>
      <Stack direction="row" height="100%">
        <InstructionsSidebar steps={stepTitles} currentStep={currentStep} onStepClick={setCurrentStep} />

        <div className={styles.contentWrapper}>
          <InstructionStepComponent step={feature.steps[currentStep]} />
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
  `,
});
