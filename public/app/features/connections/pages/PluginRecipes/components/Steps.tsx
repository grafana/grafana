import { css, cx } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { PluginRecipeStep, StepStatus } from '../types';

import { Step } from './Step';

type Props = {
  steps: PluginRecipeStep[];
};

export function Steps({ steps = [] }: Props): ReactElement {
  const styles = useStyles2(getStyles);
  const [activeStepIndex, setActiveStepIndex] = useState(findActiveStepIndex(steps));
  const isStepCompleted = (step: PluginRecipeStep) => step.status?.status === StepStatus.Completed;
  const isStepActive = (i: number) => i === activeStepIndex;
  const isStepExpandable = (step: PluginRecipeStep) => step.action === 'prompt' || step.action === 'display-info';

  // TODO: make this listen to changes from the backend as well
  const goToNextStep = () => {
    setActiveStepIndex(activeStepIndex + 1);
  };

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          className={cx(styles.stepContainer, isStepActive(i) && isStepExpandable(step) && styles.stepContainerActive)}
        >
          {/* Step number */}
          <div className={styles.leftColumn}>
            <div
              className={cx(
                styles.stepNumber,
                isStepActive(i) && styles.stepNumberActive,
                isStepCompleted(step) && styles.stepNumberCompleted
              )}
            >
              {/* Show only a loading indicator in case the step cannot be actioned on by the user */}
              {isStepActive(i) && !isStepExpandable(step) ? (
                <LoadingPlaceholder text="" className={styles.loadingIndicator} />
              ) : (
                i + 1
              )}
            </div>

            {/* Vertical line */}
            {isStepActive(i) && isStepExpandable(step) && <div className={styles.verticalLine} />}
          </div>

          {/* Step content */}
          <div className={cx(styles.stepContent, !isStepActive(i) && styles.stepContentNotCompleted)}>
            <Step step={step} isOpen={i === activeStepIndex} onComplete={goToNextStep} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Returns the first not-completed step
function findActiveStepIndex(steps: PluginRecipeStep[] = []): number {
  const activeStep = steps.find((step) => step.status?.status === StepStatus.NotCompleted);

  // No active step, point to the first step
  if (!activeStep) {
    return 0;
  }

  return steps.indexOf(activeStep);
}

const getStyles = () => ({
  stepContainer: css`
    display: flex;
    margin-bottom: 10px;
  `,

  stepContainerActive: css`
    min-height: 150px;
  `,

  leftColumn: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 35px;
  `,

  verticalLine: css`
    height: calc(100% - 45px);
    width: 2px;
    background-color: white;
    margin-top: 10px;
  `,

  stepNumber: css`
    color: #7f7f7f;
    border: 2px solid #7f7f7f;
    font-weight: bold;
    font-size: 20px;
    border-radius: 30px;
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  stepNumberActive: css`
    color: white;
    border-color: white;
  `,

  stepNumberCompleted: css`
    background-color: green;
    color: green;
  `,

  stepContent: css`
    padding-left: 15px;
  `,

  stepContentNotCompleted: css`
    color: #7f7f7f;
  `,

  loadingIndicator: css`
    margin-bottom: 2px;
  `,
});
