import { css, cx } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { Icon, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { PluginRecipeStep, PluginRecipeAction, StepStatus, PluginRecipe } from '../types';

import { Step } from './Step';

type Props = {
  recipe: PluginRecipe;
};

export function Steps({ recipe }: Props): ReactElement {
  const { steps } = recipe;
  const styles = useStyles2(getStyles);
  const [activeStepIndex] = useState(findActiveStepIndex(steps));
  const isStepCompleted = (step: PluginRecipeStep) => step.status.code === StepStatus.Completed;
  const isStepNotCompleted = (step: PluginRecipeStep) => step.status.code === StepStatus.NotCompleted;
  const isStepLoading = (step: PluginRecipeStep) => step.status.code === StepStatus.Loading;
  const isStepError = (step: PluginRecipeStep) => step.status.code === StepStatus.Error;
  const isStepActive = (i: number) => i === activeStepIndex;
  const isStepExpandable = (step: PluginRecipeStep) =>
    step.action === PluginRecipeAction.Prompt || step.action === PluginRecipeAction.DisplayInfo;
  const shouldShowLoading = (step: PluginRecipeStep, i: number) =>
    isStepLoading(step) || (isStepNotCompleted(step) && isStepActive(i) && isStepExpandable(step));
  const shouldExpandStep = (step: PluginRecipeStep, i: number) =>
    isStepNotCompleted(step) && isStepActive(i) && isStepExpandable(step);

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          className={cx(styles.stepContainer, isStepActive(i) && isStepExpandable(step) && styles.stepContainerActive)}
        >
          <div className={styles.leftColumn}>
            {/* Step number */}
            <div
              className={cx(
                styles.stepNumber,
                isStepActive(i) && styles.stepNumberActive,
                isStepCompleted(step) && styles.stepNumberCompleted,
                isStepError(step) && styles.stepNumberError
              )}
            >
              {/* Loading indicator */}
              {shouldShowLoading(step, i) ? (
                <LoadingPlaceholder text="" className={styles.loadingIndicator} />
              ) : isStepCompleted(step) ? (
                <Icon name="check" size="lg" />
              ) : isStepError(step) ? (
                <Icon name="exclamation-triangle" />
              ) : (
                i + 1
              )}
            </div>

            {/* Vertical line */}
            {isStepActive(i) && isStepExpandable(step) && <div className={styles.verticalLine} />}
          </div>

          {/* Step content */}
          <div
            className={cx(
              styles.stepContent,
              isStepNotCompleted(step) && styles.stepContentNotCompleted,
              isStepCompleted(step) && styles.stepContentCompleted,
              isStepError(step) && styles.stepContentError
            )}
          >
            <Step recipe={recipe} stepIndex={i} isOpen={shouldExpandStep(step, i)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Returns the first not-completed step
function findActiveStepIndex(steps: PluginRecipeStep[] = []): number {
  const activeStep = steps.find((step) => step.status.code === StepStatus.NotCompleted);

  // No active step, point to the first step
  if (!activeStep) {
    return 0;
  }

  return steps.indexOf(activeStep);
}

const successColor = '#6fc06f';
const errorColor = '#f26f6f';
const getStyles = () => ({
  stepContainer: css`
    display: flex;
    margin-bottom: 5px;
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
    background-color: #ffffff66;
    margin-top: 10px;
  `,

  stepNumber: css`
    color: #7f7f7f;
    border: 1px solid #7f7f7f;
    font-size: 17px;
    border-radius: 30px;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  stepNumberActive: css`
    color: white;
    border-color: white;
  `,

  stepNumberCompleted: css`
    border-color: ${successColor};
    color: ${successColor};
  `,

  stepNumberError: css`
    border-color: ${errorColor};
    color: ${errorColor};
  `,

  stepContent: css`
    padding-left: 15px;
    padding-bottom: 10px;
    flex-grow: 1;
  `,

  stepContentCompleted: css`
    color: #b8b8b8;
  `,

  stepContentNotCompleted: css`
    color: #7f7f7f;
  `,

  stepContentError: css`
    color: ${errorColor};
  `,

  loadingIndicator: css`
    margin-bottom: 0px;
    margin-left: 1px;
  `,
});
