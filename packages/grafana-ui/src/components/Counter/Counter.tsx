import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme, locale } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  // theme.isDark ? 1 : -0.7
  return {
    counter: css`
      label: counter;
      border-radius: ${theme.spacing.lg};
      background-color: ${theme.isLight ? theme.colors.gray95 : theme.colors.gray15};
      padding: 0 ${theme.spacing.sm};
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
