import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './styles';
import { InstructionStepComponentProps } from './types';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';
import { Icon } from '@grafana/ui';

export const InstructionStepComponent = ({ step, totalSteps, copied, onCopy }: InstructionStepComponentProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={step.fulfilled ? styles.fulfilledStepContent : styles.stepContent}>
      <div className={styles.stepIndicator}>
        {step.fulfilled ? (
          <Icon name="check-circle" className={styles.fulfilledIcon} />
        ) : (
          <span className={styles.stepIndicatorActive}>{totalSteps}</span>
        )}
        <h3 className={step.fulfilled ? styles.stepTitleCompleted : styles.stepTitleActive}>
          {step.title}
          {step.fulfilled && <span className={styles.fulfilledBadge}>Completed</span>}
        </h3>
      </div>
      {step.description && <p>{step.description}</p>}
      {step.code && <CodeBlockWithCopy code={step.code} copyCode={step.copyCode} />}
    </div>
  );
};
