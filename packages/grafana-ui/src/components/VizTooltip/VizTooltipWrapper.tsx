import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const VizTooltipWrapper = ({ children, className }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={clsx(styles, className)} data-testid={selectors.components.Panels.Visualization.Tooltip.Wrapper}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
  });
