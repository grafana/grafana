import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/** @alpha */
export interface VizTooltipWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /**
   * Controls how the tooltip sizes itself horizontally. Defaults to `auto`, which preserves the
   * existing behaviour of growing to fit content. `narrow` is not implemented yet.
   */
  size?: VizTooltipSize;
}

/** @alpha */
export const VizTooltipWrapper = ({ children, className, size = DEFAULT_VIZ_TOOLTIP_SIZE }: VizTooltipWrapperProps) => {
  const styles = useStyles2(getStyles);

  if (size === 'narrow') {
    throw new Error("VizTooltipWrapper: size='narrow' is not implemented yet");
  }

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
