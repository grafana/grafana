import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, locale } from '@grafana/data';

import { stylesFactory, useStyles2 } from '../../themes';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    counter: css({
      label: 'counter',
      marginLeft: theme.spacing(1),
      borderRadius: theme.spacing(3),
      backgroundColor: theme.colors.action.hover,
      padding: theme.spacing(0.25, 1),
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
    }),
  };
});

export interface CounterProps {
  value: number;
}

export const Counter = ({ value }: CounterProps) => {
  const styles = useStyles2(getStyles);

  return <span className={styles.counter}>{locale(value, 0).text}</span>;
};
