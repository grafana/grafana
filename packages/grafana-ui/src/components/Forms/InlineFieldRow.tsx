import { css, cx } from '@emotion/css';
import React, { HTMLProps, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'css'> {
  children: ReactNode | ReactNode[];
}

export const InlineFieldRow = ({ children, className, ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      label: InlineFieldRow;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: flex-start;
      row-gap: ${theme.spacing(0.5)};
    `,
  };
};
