import React, { FC, useMemo } from 'react';
import { cx } from 'emotion';
import { useStyles } from '@grafana/ui';
import { getStyles } from './ProgressBar.styles';
import { ProgressBarProps, ProgressBarStatus } from './ProgressBar.types';
import { getProgressBarPercentage } from './ProgressBar.utils';

export const ProgressBar: FC<ProgressBarProps> = ({ finishedSteps, totalSteps, status, message, dataTestId }) => {
  const styles = useStyles(getStyles);
  const progressBarErrorStyles = useMemo(
    () => ({
      [styles.progressBarError]: status === ProgressBarStatus.error,
    }),
    [status]
  );
  const stepsLabelErrorStyles = useMemo(
    () => ({
      [styles.stepsLabelError]: status === ProgressBarStatus.error,
    }),
    [status]
  );
  const width = getProgressBarPercentage(finishedSteps, totalSteps);

  return (
    <div className={styles.progressBarWrapper} data-testid={dataTestId}>
      <div className={styles.labelWrapper}>
        <span data-testid="progress-bar-steps" className={cx(styles.stepsLabel, stepsLabelErrorStyles)}>
          {finishedSteps === 0 && totalSteps === 0 ? '-/-' : `${finishedSteps}/${totalSteps}`}
        </span>
        <span data-testid="progress-bar-message" className={styles.message} title={message}>
          {message}
        </span>
      </div>
      <div data-testid="progress-bar-content" className={styles.progressBarBackground}>
        <div className={cx(styles.getFillerStyles(width), progressBarErrorStyles)} />
      </div>
    </div>
  );
};
