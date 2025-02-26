import React, { useState } from 'react';
import { Modal, Button, useStyles2 } from '@grafana/ui';
import { getStyles } from './styles';
import { InstructionsModalProps } from './types';
import { css } from '@emotion/css';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';

export const InstructionsModal = ({ feature, isOpen, onDismiss }: InstructionsModalProps) => {
  const styles = useStyles2(getStyles);
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

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={customStyles.modal}>
      <div className={customStyles.stepIndicator}>
        <span className={customStyles.stepNumber}>{currentStep + 1}</span>
        <span className={customStyles.stepTitle}>{currentStepData?.title}</span>
      </div>

      <div className={customStyles.content}>
        <p className={customStyles.description}>{currentStepData?.description}</p>

        {currentStepData?.code && (
          <CodeBlockWithCopy code={currentStepData.code} className={customStyles.codeBlockCustom} />
        )}
      </div>

      <div className={customStyles.footer}>
        <Button variant="secondary" onClick={onDismiss}>
          Close
        </Button>

        <div className={customStyles.navigationButtons}>
          <Button variant="secondary" onClick={handlePrevious} disabled={isFirstStep}>
            Previous
          </Button>
          <Button variant="primary" onClick={handleNext} disabled={isLastStep}>
            Next
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const getCustomStyles = () => {
  return {
    modal: css`
      width: 650px;
      max-width: 95%;
    `,
    stepIndicator: css`
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      padding: 0 8px;
    `,
    stepNumber: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #3274d9;
      color: white;
      font-weight: 500;
      margin-right: 12px;
    `,
    stepTitle: css`
      font-size: 18px;
      font-weight: 500;
      color: #d8d9da;
    `,
    content: css`
      padding: 0 8px 24px 8px;
    `,
    description: css`
      margin-bottom: 16px;
      font-size: 14px;
    `,
    codeBlockCustom: css`
      margin: 0;
      min-height: 100px;
    `,
    footer: css`
      display: flex;
      justify-content: space-between;
      padding: 16px 8px;
      border-top: 1px solid #222426;
    `,
    navigationButtons: css`
      display: flex;
      gap: 8px;
    `,
  };
};
