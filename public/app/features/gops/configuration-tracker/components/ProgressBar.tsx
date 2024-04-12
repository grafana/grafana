import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

export function ProgressBar({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  const styles = useStyles2(getStyles);
  if (totalStepsToDo === 0) {
    return null;
  }
  return (
    <div className={styles.containerStyles}>
      <div className={styles.fillerStyles((stepsDone / totalStepsToDo) * 100)} />
    </div>
  );
}
export function StepsStatus({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  return (
    <div>
      <Text color="success">{stepsDone}</Text> of {totalStepsToDo}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    containerStyles: css({
      height: theme.spacing(2),
      borderRadius: theme.shape.borderRadius(8),
      backgroundColor: theme.colors.border.weak,
      border: `1px solid ${theme.colors.border.strong}`,
      flex: 'auto',
    }),
    fillerStyles: (stepsDone: number) =>
      css({
        height: '100%',
        width: `${stepsDone}%`,
        backgroundColor: theme.colors.success.main,
        borderRadius: theme.shape.borderRadius(8),
        textAlign: 'right',
      }),
  };
}
