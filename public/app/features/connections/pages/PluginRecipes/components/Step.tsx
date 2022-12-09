import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { isInstrucitonStep, isPromptStep, StepStatus, PluginRecipe } from '../types';

import { StepInstruction } from './StepInstruction';
import { StepPrompt } from './StepPrompt';

type Props = {
  recipe: PluginRecipe;

  stepIndex: number;

  // Displays the step content if set to TRUE
  isOpen: boolean;
};

export function Step({ recipe, stepIndex, isOpen }: Props): ReactElement {
  const step = recipe.steps[stepIndex];
  const styles = useStyles2(getStyles);

  return (
    <div>
      {/* Name */}
      <div className={styles.stepName}>{step.name}</div>

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
  stepName: css`
    font-size: 18px;
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
