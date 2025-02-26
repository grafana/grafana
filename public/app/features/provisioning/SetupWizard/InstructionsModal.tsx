import React, { useState } from 'react';
import { Modal, Button, useStyles2, Icon } from '@grafana/ui';
import { FeatureInfo } from './types';
import { css } from '@emotion/css';
import { InstructionStepComponent } from './InstructionStepComponent';
import { InstructionsSidebar } from './InstructionsSidebar';

// Moved from types.ts and renamed to Props
export interface Props {
  feature: FeatureInfo;
  isOpen: boolean;
  onDismiss: () => void;
}

export const InstructionsModal = ({ feature, isOpen, onDismiss }: Props) => {
  const customStyles = useStyles2(getCustomStyles);
  const [currentStep, setCurrentStep] = useState(0);

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

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
  };

  const handleDone = () => {
    onDismiss();
  };

  // Find the first unfulfilled step
  const firstUnfulfilledStep = feature.steps.findIndex((step) => !step.fulfilled);
  const initialStep = firstUnfulfilledStep === -1 ? 0 : firstUnfulfilledStep;

  // Use initialStep if currentStep is still 0 (initial render)
  React.useEffect(() => {
    if (currentStep === 0 && initialStep !== 0) {
      setCurrentStep(initialStep);
    }
  }, [currentStep, initialStep]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === feature.steps.length - 1;
  const currentStepData = feature.steps[currentStep];
  const sideBarSteps = feature.steps.map((step) => step.title);

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={customStyles.modal}>
      <div className={customStyles.modalContent}>
        <InstructionsSidebar steps={sideBarSteps} currentStep={currentStep} onStepClick={handleStepClick} />

        <div className={customStyles.mainContent}>
          <div className={customStyles.contentWrapper}>
            <InstructionStepComponent step={currentStepData} />
          </div>
          <div className={customStyles.footer}>
            <div className={customStyles.navigationButtons}>
              <Button variant="secondary" onClick={handlePrevious} disabled={isFirstStep}>
                Previous
              </Button>

              {isLastStep ? (
                <Button variant="primary" onClick={handleDone} icon="check-circle">
                  Done
                </Button>
              ) : (
                <Button variant="primary" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const getCustomStyles = () => {
  return {
    modal: css`
      width: 1100px;
      max-width: 95%;
    `,
    modalContent: css`
      display: flex;
      height: 100%;
    `,
    mainContent: css`
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-y: auto;
    `,
    contentWrapper: css`
      flex: 1;
      padding-bottom: 70px; /* Space for footer */
    `,
    footer: css`
      position: sticky;
      bottom: 0;
      right: 0;
      left: 0;
      padding: 16px 24px;
      border-top: 1px solid #222426;
      display: flex;
      justify-content: flex-end;
      z-index: 1;
    `,
    navigationButtons: css`
      display: flex;
      gap: 8px;
    `,
  };
};
