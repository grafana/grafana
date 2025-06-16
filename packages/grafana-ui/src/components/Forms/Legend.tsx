import { css, cx } from '@emotion/css';
import { ReactNode } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface LabelProps extends React.HTMLAttributes<HTMLLegendElement> {
  children: string | ReactNode;
  description?: string;
}

export const getLegendStyles = (theme: GrafanaTheme2) => {
  return {
    legend: css({
      fontSize: theme.typography.h3.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
      margin: theme.spacing(0, 0, 2, 0),
    }),
  };
};

export const Legend = ({ children, className, ...legendProps }: LabelProps) => {
  const styles = useStyles2(getLegendStyles);

  return (
    <legend className={cx(styles.legend, className)} {...legendProps}>
      {children}
    </legend>
  );
};
