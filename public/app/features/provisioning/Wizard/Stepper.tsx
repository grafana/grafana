import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';

export interface Step<T> {
  id: T;
  name: string;
  title: string;
  submitOnNext?: boolean;
}

export interface Props<T extends string | number> {
  activeStep?: T;
  reportId?: string;
  visitedSteps?: T[];
  steps: Array<Step<T>>;
}

export function Stepper<T extends string | number>({ visitedSteps = [], steps, activeStep = steps[0]?.id }: Props<T>) {
  const styles = useStyles2(getStyles);

  return (
    <ol className={styles.container}>
      {steps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isCompleted = visitedSteps.includes(step.id) && !isActive;
        const isLast = index === steps.length - 1;

        const stepTextClass = cx(styles.stepText, {
          [styles.activeStepText]: isActive,
        });

        return (
          <li key={step.id} className={styles.stepContainer}>
            <div className={styles.stepContent}>
              {isCompleted ? (
                <div className={cx(styles.stepNumber, styles.completedStepNumber)}>
                  <Icon name="check" size="sm" />
                </div>
              ) : (
                <div className={styles.stepNumber}>{index + 1}</div>
              )}
              <div className={stepTextClass}>{step.name}</div>
            </div>
            {!isLast && <div className={styles.connector} />}
          </li>
        );
      })}
    </ol>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      margin: theme.spacing(2, 0),
      padding: 0,
      listStyle: 'none',
      width: 200,
    }),
    stepContainer: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      position: 'relative',
    }),
    stepContent: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0.5, 0),
    }),
    stepNumber: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: theme.spacing(3),
      width: theme.spacing(3),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      marginRight: theme.spacing(1),
    }),
    completedStepNumber: css({
      color: theme.colors.success.main,
    }),
    stepText: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.md,
    }),
    activeStepText: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    connector: css({
      width: '1px',
      backgroundColor: theme.colors.border.medium,
      height: theme.spacing(2),
      marginLeft: theme.spacing(1.5),
      marginTop: theme.spacing(0.5),
    }),
  };
};
