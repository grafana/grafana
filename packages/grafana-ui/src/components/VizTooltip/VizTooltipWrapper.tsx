import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipContext } from './VizTooltipContext';
import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/**
 * Max width applied when a tooltip opts into the `narrow` size. Derived from the theme's `sm`
 * breakpoint so it stays in step with the rest of the layout system rather than being a magic value.
 */
const getNarrowMaxWidth = (theme: GrafanaTheme2) => theme.breakpoints.values.sm;

/** @alpha */
export interface VizTooltipWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /**
   * Controls how the tooltip sizes itself horizontally. Defaults to `auto`, which preserves the
   * legacy behaviour of growing to fit content. Pass `narrow` to constrain the width and wrap long
   * values instead of forcing the tooltip wider.
   */
  size?: VizTooltipSize;
}

/** @alpha */
export const VizTooltipWrapper = ({ children, className, size = DEFAULT_VIZ_TOOLTIP_SIZE }: VizTooltipWrapperProps) => {
  const styles = useStyles2(getStyles, size);
  return (
    <VizTooltipContext.Provider value={size}>
      <div className={clsx(styles, className)} data-testid={selectors.components.Panels.Visualization.Tooltip.Wrapper}>
        {children}
      </div>
    </VizTooltipContext.Provider>
  );
};

const getStyles = (theme: GrafanaTheme2, size: VizTooltipSize) =>
  css({
    display: 'flex',
    flexDirection: 'column',
    maxWidth: size === 'narrow' ? getNarrowMaxWidth(theme) : undefined,
    fontSize: theme.typography.bodySmall.fontSize,
  });
