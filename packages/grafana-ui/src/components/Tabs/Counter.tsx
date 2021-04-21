import React, { FC } from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useStyles2 } from '../../themes';
import { GrafanaThemeV2, locale } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaThemeV2) => {
  return {
    counter: css`
      label: counter;
      margin-left: ${theme.spacing(1)};
      border-radius: ${theme.spacing(3)};
      background-color: ${theme.palette.action.hover};
      padding: ${theme.spacing(0.25, 1)};
      color: ${theme.palette.text.secondary};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
    `,
  };
});

export interface CounterProps {
  value: number;
}

export const Counter: FC<CounterProps> = ({ value }) => {
  const styles = useStyles2(getStyles);

  return <span className={styles.counter}>{locale(value, 0).text}</span>;
};
