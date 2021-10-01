import React, { FC, useEffect, useRef, useState } from 'react';
import { cx } from 'emotion';
import { useStyles, Icon } from '@grafana/ui';
import { getStyles } from './Step.styles';

export interface StepProps {
  title?: string;
  number?: number;
  status?: StepStatus;
  disabled?: boolean;
  isLast?: boolean;
  dataTestId?: string;
  onClick: () => void;
}

export enum StepStatus {
  current = 'current',
  done = 'done',
  invalid = 'invalid',
  todo = 'todo',
}

export const Step: FC<StepProps> = ({
  children,
  title,
  number,
  status = StepStatus.todo,
  disabled,
  isLast = false,
  dataTestId,
  onClick,
}) => {
  const styles = useStyles(getStyles);
  const stepCircleStatusStyles = {
    [styles.stepCircleCurrent]: status === StepStatus.current,
    [styles.stepCircleDone]: status === StepStatus.done,
    [styles.stepCircleInvalid]: status === StepStatus.invalid,
  };
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const clientHeight = contentRef.current?.clientHeight as number;

    setContentHeight(status === StepStatus.current ? clientHeight : 0);
  }, [status]);

  return (
    <div className={styles.step} data-testid={dataTestId}>
      <div
        className={cx(styles.stepHeader, { [styles.stepDisabled]: disabled })}
        onClick={onClick}
        data-testid="step-header"
      >
        <div className={cx(styles.stepCircle, stepCircleStatusStyles)}>
          {status === StepStatus.done ? <Icon name="check" /> : number}
        </div>
        <div className={styles.stepTitle}>{title}</div>
      </div>
      <div className={cx(styles.stepContentWrapper, { [styles.stepVerticalLine]: !isLast })} data-testid="step-content">
        <div
          className={cx(styles.stepContentTransitionWrapper, {
            [styles.stepContentTransitionCurrent(contentHeight)]: status === StepStatus.current,
          })}
        >
          <div ref={contentRef} className={cx(styles.stepContent)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
