import { css, cx } from '@emotion/css';
import React, { FC, HTMLProps, ReactNode } from 'react';

import { GrafanaTheme } from '@grafana/data';

import { useStyles } from '../../themes';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'css'> {
  children: ReactNode | ReactNode[];
}

export const InlineFieldRow: FC<Props> = ({ children, className, ...htmlProps }) => {
  const styles = useStyles(getStyles);
  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      label: InlineFieldRow;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: flex-start;
      row-gap: ${theme.spacing.xs};
    `,
  };
};
