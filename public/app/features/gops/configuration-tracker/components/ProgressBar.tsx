import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { Trans } from '../../../../core/internationalization';

export function ProgressBar({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  const styles = useStyles2(getStyles);
  if (totalStepsToDo === 0) {
    return null;
  }
  return (
    <div className={styles.containerStyles} role="progressbar" aria-valuenow={stepsDone} aria-valuemax={totalStepsToDo}>
      <div className={styles.fillerStyles((stepsDone / totalStepsToDo) * 100)} />
    </div>
  );
}
export function StepsStatus({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  return (
    <span>
      <Trans i18nKey="gops.progress-bar.steps-status" values={{ stepsDone }}>
        <Text color="success">{'{{stepsDone}}'}</Text> of {{ totalStepsToDo }}
      </Trans>
    </span>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    containerStyles: css({
      height: theme.spacing(2),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.border.weak,
      flex: 'auto',
    }),
    fillerStyles: (stepsDone: number) =>
      css({
        height: '100%',
        width: `${stepsDone}%`,
        backgroundColor: theme.colors.success.main,
        borderRadius: theme.shape.radius.pill,
        textAlign: 'right',
      }),
  };
}
