import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme, locale } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    counter: css`
      label: counter;
      margin-left: ${theme.spacing.sm};
      border-radius: ${theme.spacing.lg};
      background-color: ${theme.colors.bg2};
      padding: ${theme.spacing.xxs} ${theme.spacing.sm};
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

  return <span className={styles.counter}>{locale(value, 0).text}</span>;
};
