import React, { useState } from 'react';
import { Modal, Button, useStyles2, Icon, Container } from '@grafana/ui';
import { FeatureInfo } from './types';
import { css } from '@emotion/css';
import { InstructionStepComponent } from './InstructionStepComponent';

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

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={customStyles.modal}>
      <div className={customStyles.modalContent}>
        <div className={customStyles.sidebar}>
          {feature.steps.map((step, index) => {
            // Determine the status of this step
            const isCompleted = step.fulfilled;
            const isCurrent = index === currentStep;
            const isPending = !isCompleted && !isCurrent;

            // Determine if the connector line should be colored
            const isConnectorColored =
              index < feature.steps.length - 1 && feature.steps.slice(0, index + 1).every((s) => s.fulfilled);

            return (
              <div
                key={index}
                className={`${customStyles.timelineItem} ${isCurrent ? customStyles.activeStep : ''}`}
                onClick={() => handleStepClick(index)}
              >
                <div className={customStyles.timelineConnector}>
                  <div
                    className={`
                      ${customStyles.timelineDot} 
                      ${isCompleted ? customStyles.completedDot : ''} 
                      ${isCurrent ? customStyles.currentDot : ''} 
                      ${isPending ? customStyles.pendingDot : ''}
                    `}
                  >
                    {isCompleted && <Icon name="check" className={customStyles.checkIcon} />}
                    {isCurrent && !isCompleted && <span className={customStyles.currentStepDot}></span>}
                  </div>
                  {index < feature.steps.length - 1 && (
                    <div
                      className={`
                        ${customStyles.connector} 
                        ${isConnectorColored ? customStyles.completedConnector : ''}
                      `}
                    ></div>
                  )}
                </div>
                <div
                  className={`
                    ${customStyles.timelineContent} 
                    ${isCompleted ? customStyles.completedText : ''} 
                    ${isCurrent ? customStyles.currentText : ''}
                  `}
                >
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>

        <div className={customStyles.mainContent}>
          <Container padding="md">
            <InstructionStepComponent step={currentStepData} />
          </Container>
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
    sidebar: css`
      width: 260px;
      padding: 16px 0;
      border-right: 1px solid #222426;
      overflow-y: auto;
    `,
    mainContent: css`
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
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
    `,
    connector: css`
      position: absolute;
      top: 20px;
      bottom: -20px;
      left: 50%;
      width: 2px;
      background: #333;
      transform: translateX(-50%);
    `,
    completedConnector: css`
      background: #3274d9;
    `,
    timelineDot: css`
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
    `,
    completedDot: css`
      background: #3274d9;
      border: 2px solid #3274d9;
    `,
    currentDot: css`
      background: #1f60c4;
      border: 2px solid #3274d9;
    `,
    pendingDot: css`
      background: #333;
      border: 2px solid #555;
    `,
    currentStepDot: css`
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: white;
    `,
    checkIcon: css`
      color: white;
      font-size: 12px;
    `,
    timelineContent: css`
      flex: 1;
      font-size: 14px;
      padding-top: 2px;
    `,
    completedText: css`
      color: #3274d9;
    `,
    currentText: css`
      color: white;
      font-weight: 500;
    `,
    content: css`
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      margin-bottom: 60px;
    `,
    footer: css`
      position: absolute;
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
