import React, { useState } from 'react';
import { Modal, Button, useStyles2, Icon } from '@grafana/ui';
import { InstructionsModalProps } from './types';
import { css } from '@emotion/css';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';

export const InstructionsModal = ({ feature, isOpen, onDismiss }: InstructionsModalProps) => {
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
      <div className={customStyles.modalContent}>
        <div className={customStyles.sidebar}>
          {feature.steps.map((step, index) => (
            <div
              key={index}
              className={`${customStyles.timelineItem} ${index === currentStep ? customStyles.activeStep : ''}`}
              onClick={() => handleStepClick(index)}
            >
              <div className={customStyles.timelineConnector}>
                <div className={customStyles.timelineDot}>
                  {step.fulfilled ? <Icon name="check" className={customStyles.checkIcon} /> : null}
                </div>
              </div>
              <div className={customStyles.timelineContent}>{step.title}</div>
            </div>
          ))}
        </div>

        <div className={customStyles.mainContent}>
          <div className={customStyles.stepIndicator}>
            <span className={customStyles.stepNumber}>{currentStep + 1}</span>
            <span className={customStyles.stepTitle}>{currentStepData?.title}</span>
          </div>

          <div className={customStyles.content}>
            <p className={customStyles.description}>{currentStepData?.description}</p>

            {currentStepData?.code && (
              <CodeBlockWithCopy
                code={currentStepData.code}
                className={customStyles.codeBlockCustom}
                copyCode={currentStepData.copyCode}
              />
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
        </div>
      </div>
    </Modal>
  );
};

const getCustomStyles = () => {
  return {
    modal: css`
      width: 850px;
      max-width: 95%;
    `,
    modalContent: css`
      display: flex;
      height: 100%;
    `,
    sidebar: css`
      width: 220px;
      padding: 16px 0;
      border-right: 1px solid #222426;
      overflow-y: auto;
    `,
    mainContent: css`
      flex: 1;
      display: flex;
      flex-direction: column;
    `,
    timelineItem: css`
      display: flex;
      padding: 8px 16px;
      cursor: pointer;
      position: relative;
      &:hover {
        background: rgba(204, 204, 220, 0.07);
      }
    `,
    activeStep: css`
      background: rgba(204, 204, 220, 0.1);
      font-weight: 500;
    `,
    timelineConnector: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-right: 12px;
      position: relative;

      &:before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        background: #333;
        transform: translateX(-50%);
        z-index: 0;
      }
    `,
    timelineDot: css`
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
    `,
    checkIcon: css`
      color: #3274d9;
      font-size: 12px;
    `,
    timelineContent: css`
      flex: 1;
      font-size: 14px;
    `,
    stepIndicator: css`
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      padding: 16px 16px 0;
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
      padding: 0 16px 24px;
      flex: 1;
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
      padding: 16px;
      border-top: 1px solid #222426;
    `,
    navigationButtons: css`
      display: flex;
      gap: 8px;
    `,
  };
};
