import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { isInstrucitonStep, isPromptStep, StepStatus, PluginRecipe } from '../types';
import { isStepCompleted, isStepExpandable, isStepExpanded } from '../utils';

import { StepInstruction } from './StepInstruction';
import { StepPrompt } from './StepPrompt';

type Props = {
  recipe: PluginRecipe;
  stepIndex: number;
};

export function Step({ recipe, stepIndex }: Props): ReactElement {
  const [isOpen, setIsOpen] = useState(isStepExpanded(recipe, stepIndex));
  const step = recipe.steps[stepIndex];
  const isExpandable = isStepExpandable(step);
  const isCompleted = isStepCompleted(step);
  const styles = useStyles2(getStyles);

  return (
    <div>
      {/* Name */}
      <div className={styles.stepNameContainer}>
        <div className={styles.stepName}>{step.name}</div>
        {isCompleted && isExpandable && (
          <Button className={styles.toggleButton} variant="secondary" size="sm" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? 'Hide' : 'Show'}
          </Button>
        )}
      </div>

      {/* Error */}
      {Boolean(step.status.code === StepStatus.Error) && (
        <div className={styles.stepErrorMessage}>
          <strong>Error: </strong>&quot;{step.status.message}&quot;
        </div>
      )}

      {/* Content */}
      {isOpen && (
        <>
          {/* Description */}
          {Boolean(step.description) && <div className={styles.stepDescription}>{step.description}</div>}

          {/* Content */}
          <StepContent recipe={recipe} stepIndex={stepIndex} />
        </>
      )}
    </div>
  );
}

export function StepContent({ recipe, stepIndex }: Omit<Props, 'isOpen'>): ReactElement | null {
  const step = recipe.steps[stepIndex];

  if (isInstrucitonStep(step)) {
    return <StepInstruction recipe={recipe} step={step} stepIndex={stepIndex} />;
  }

  if (isPromptStep(step)) {
    return <StepPrompt recipe={recipe} step={step} stepIndex={stepIndex} />;
  }

  return null;
}

const getStyles = () => ({
  stepNameContainer: css`
    display: flex;
    align-items: center;
  `,

  stepName: css`
    font-size: 18px;
  `,

  toggleButton: css`
    margin-left: 10px;
    padding: 0px 6px;
    height: 20px;
    font-size: 11px;
  `,

  stepDescription: css`
    font-size: 13px;
    color: #ffffff69;
  `,

  stepErrorMessage: css`
    font-size: 13px;
    background: #0000004f;
    padding: 1px 7px;
    border: 1px solid #ffffff1a;
    border-radius: 4px;
  `,
});
