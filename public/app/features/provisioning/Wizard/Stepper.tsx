import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';

import { ValidationResult } from './types';

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
  validationResults: Record<T, ValidationResult>;
}

export function Stepper<T extends string | number>({
  validationResults,
  visitedSteps = [],
  steps,
  activeStep = steps[0]?.id,
}: Props<T>) {
  const styles = useStyles2(getStyles);
  const lastStep = steps[steps.length - 1];

  return (
    <ol className={styles.container}>
      {steps.map((step) => {
        const isLast = step.id === lastStep.id;
        const isActive = step.id === activeStep;
        const isVisited = visitedSteps.includes(step.id);
        const hasMissingFields = !validationResults[step.id].valid;
        const showIndicator = !isActive && isVisited;
        const successField = showIndicator && !hasMissingFields;
        const warnField = showIndicator && hasMissingFields;
        const itemStyles = cx(styles.item, {
          [styles.active]: isActive,
          [styles.successItem]: successField,
          [styles.warnItem]: warnField,
        });

        return (
          <li key={step.id} className={itemStyles}>
            {successField && <Icon name={'check'} size={'xl'} className={styles.successItem} />}
            {warnField && <Icon name={'exclamation-triangle'} className={styles.warnItem} />}
            <div className={styles.link}>{step.name}</div>
            {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
            {!isLast && <div className={styles.divider}>&#8212;</div>}
          </li>
        );
      })}
    </ol>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      counterReset: 'item',
      listStyleType: 'none',
      width: '100%',
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(4, 0),
    }),
    item: css({
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
    }),
    successItem: css({
      'a::before': {
        content: '""',
      },
      svg: {
        color: theme.colors.success.text,
        margin: theme.spacing(0, 0.5, 0, -1),
      },
    }),
    warnItem: css({
      'a::before': {
        content: '""',
      },
      svg: {
        color: theme.colors.warning.text,
        margin: theme.spacing(0, 1, 0.5, -0.5),
      },
    }),
    link: css({
      color: 'inherit',
      '&::before': {
        content: 'counter(item) "  "',
        counterIncrement: 'item',
      },
    }),
    active: css({
      fontWeight: 500,
      color: theme.colors.text.maxContrast,
      '&::before': {
        fontWeight: 500,
      },
    }),
    divider: css({
      padding: theme.spacing(2),
    }),
  };
};
