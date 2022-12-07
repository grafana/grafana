import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { PluginRecipeStep, isInstrucitonStep, isPromptStep } from '../types';

import { StepInstruction } from './StepInstruction';
import { StepPrompt } from './StepPrompt';

type Props = {
  // The step information
  step: PluginRecipeStep;

  // Displays the step content if set to TRUE
  isOpen: boolean;

  // Called when the step is completed
  onComplete: () => void;
};

export function Step({ step, isOpen, onComplete }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  return (
    <div>
      {/* Name */}
      <div className={styles.stepName}>{step.meta?.name}</div>

      {isOpen && (
        <>
          {/* Description */}
          {Boolean(step.meta?.description) && <div className={styles.stepDescription}>{step.meta?.description}</div>}

          {/* Content */}
          <StepContent step={step} onComplete={onComplete} />
        </>
      )}
    </div>
  );
}

export function StepContent({ step, onComplete }: Omit<Props, 'isOpen'>): ReactElement | null {
  if (isInstrucitonStep(step)) {
    return <StepInstruction step={step} />;
  }

  if (isPromptStep(step)) {
    return <StepPrompt step={step} />;
  }

  return null;
}

const getStyles = () => ({
  stepName: css`
    font-size: 19px;
  `,

  stepDescription: css`
    font-size: 13px;
    color: #ffffff69;
  `,
});
