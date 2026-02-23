import { css } from '@emotion/css';

import { GrafanaTheme2, locale } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

type CounterVariant = 'primary' | 'secondary';
export interface CounterProps {
  value: number;
  variant?: CounterVariant;
}

export const Counter = ({ value, variant = 'secondary' }: CounterProps) => {
  const styles = useStyles2(getStyles, variant);

  return <span className={styles.counter}>{locale(value, 0).text}</span>;
};

const getStyles = (theme: GrafanaTheme2, variant: CounterVariant) => ({
  counter: css({
    label: 'counter',
    marginLeft: theme.spacing(1),
    borderRadius: theme.spacing(3),
    backgroundColor: variant === 'primary' ? theme.colors.primary.main : theme.colors.secondary.main,
    padding: theme.spacing(0.25, 1),
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
  }),
});
