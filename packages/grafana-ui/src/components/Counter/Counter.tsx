import React, { FC, useContext } from 'react';
import { css, cx } from 'emotion';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme, locale } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    counter: css`
      label: counter;
      border-radius: ${theme.spacing.lg};
      background-color: ${theme.colors.bg3};
      padding: ${theme.spacing.xxs} ${theme.spacing.xs};
      color: ${theme.colors.textWeak};
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
    `,
  };
});

export interface CounterProps {
  value: number;
}

export const Counter: FC<CounterProps> = ({ value }) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  return <span className={cx([styles.counter, 'counter'])}>{locale(value, 0).text}</span>;
};
