import { css } from '@emotion/css';
import React from 'react';
import { IconName } from 'src/types';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

export interface IndicatorProps {
  children: React.ReactNode;
  suffixIcon?: IconName;
}

export default function Indicator({ children, suffixIcon }: IndicatorProps) {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.root}>
      {children && <span>{children}</span>}
      {suffixIcon && <Icon name={suffixIcon} />}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      background: theme.components.tooltip.background,
      color: theme.components.tooltip.text,
      padding: theme.spacing(0.5, 1.5), // get's an extra .5 of vertical padding to account for the rounded corners
      ...theme.typography.bodySmall,
      borderRadius: 100, // just a sufficiently large value to ensure ends are completely rounded
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
    }),
  };
};
