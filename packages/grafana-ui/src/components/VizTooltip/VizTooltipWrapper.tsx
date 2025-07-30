import { css, cx } from '@emotion/css';
import React, { HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const VizTooltipWrapper = ({ children, className }: Props) => {
  const styles = useStyles2(getStyles);

  return <div className={cx(styles.wrapper, className)}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
