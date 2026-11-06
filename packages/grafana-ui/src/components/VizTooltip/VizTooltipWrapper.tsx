import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipContext } from './VizTooltipContext';
import { DEFAULT_VIZ_TOOLTIP_SIZE, type VizTooltipSize } from './types';

/** @alpha */
export interface VizTooltipWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /**
   * Controls how the tooltip sizes itself horizontally. Defaults to `auto`, which preserves the
   * existing behaviour of growing to fit content. `narrow` caps the width at the theme's `sm`
   * breakpoint and lets long names/values wrap instead of forcing the tooltip wider.
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
    fontSize: theme.typography.bodySmall.fontSize,
    // `auto` intentionally sets no max-width (old-system behaviour); `narrow` caps the tooltip.
    ...(size === 'narrow' && { maxWidth: theme.breakpoints.values.sm }),
  });
