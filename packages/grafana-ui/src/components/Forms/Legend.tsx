import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface LabelProps extends React.HTMLAttributes<HTMLLegendElement> {
  children: string | ReactNode;
  description?: string;
}

export const getLegendStyles = (theme: GrafanaTheme2) => {
  return {
    legend: css`
      font-size: ${theme.typography.h3.fontSize};
      font-weight: ${theme.typography.fontWeightRegular};
      margin: 0 0 ${theme.spacing(2)} 0;
    `,
  };
};

export const Legend: React.FC<LabelProps> = ({ children, className, ...legendProps }) => {
  const styles = useStyles2(getLegendStyles);

  return (
    <legend className={cx(styles.legend, className)} {...legendProps}>
      {children}
    </legend>
  );
};
