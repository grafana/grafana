import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2, locale } from '@grafana/data';

import { stylesFactory, useStyles2 } from '../../themes';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    counter: css`
      label: counter;
      margin-left: ${theme.spacing(1)};
      border-radius: ${theme.spacing(3)};
      background-color: ${theme.colors.action.hover};
      padding: ${theme.spacing(0.25, 1)};
      color: ${theme.colors.text.secondary};
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
