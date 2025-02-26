import { useStyles2, Icon } from '@grafana/ui';
import { css } from '@emotion/css';

interface InstructionsSidebarProps {
  steps: string[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const InstructionsSidebar = ({ steps, currentStep, onStepClick }: InstructionsSidebarProps) => {
  const customStyles = useStyles2(getCustomStyles);

  return (
    <div className={customStyles.sidebar}>
      {steps.map((step, index) => {
        // Determine the status of this step
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;

        // Determine if the connector line should be colored
        const isConnectorColored = index < steps.length - 1 && index < currentStep;

        return (
          <div
            key={index}
            className={`${customStyles.timelineItem} ${isCurrent ? customStyles.activeStep : ''}`}
            onClick={() => onStepClick(index)}
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
              {index < steps.length - 1 && (
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
              {step}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const getCustomStyles = () => {
  return {
    sidebar: css`
      width: 260px;
      padding: 16px 0;
      border-right: 1px solid #222426;
      overflow-y: auto;
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
  };
};
