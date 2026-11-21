import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { forwardRef, useContext, type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';

import { type TooltipMenuProps, VizTooltipContext, VizTooltipMenuContext } from './VizTooltipContext';
import { type VizTooltipSize } from './types';

/**
 * Max width applied when a tooltip opts into the `narrow` size. Derived from the theme's `sm`
 * breakpoint so it stays in step with the rest of the layout system rather than being a magic value.
 */
const getNarrowMaxWidth = (theme: GrafanaTheme2) => theme.breakpoints.values.sm;

/** @alpha */
export interface VizTooltipWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Callbacks and focus behavior for the footer's data link menu. */
  menuProps?: TooltipMenuProps;
  /** Maximum surface width in pixels, also constrained to the viewport. */
  maxWidth?: number;
  /** Whether the surface constrains its height and scrolls overflowing content. */
  scrollable?: boolean;
  /**
   * Controls how the tooltip sizes itself horizontally. Defaults to `auto`, which preserves the
   * legacy behaviour of growing to fit content. Pass `narrow` to constrain the width and wrap long
   * values instead of forcing the tooltip wider. Nested wrappers inherit the outer size when omitted.
   */
  size?: VizTooltipSize;
}

/** @alpha */
export const VizTooltipWrapper = forwardRef<HTMLDivElement, VizTooltipWrapperProps>(
  ({ children, className, menuProps, maxWidth, scrollable = true, size, ...otherProps }, ref) => {
    const parent = useContext(VizTooltipMenuContext);
    const parentSize = useContext(VizTooltipContext);
    const resolvedSize = size ?? parentSize;
    const styles = useStyles2(getStyles, maxWidth, scrollable, resolvedSize);

    return (
      <VizTooltipMenuContext.Provider value={{ menuProps: menuProps ?? parent?.menuProps }}>
        <VizTooltipContext.Provider value={resolvedSize}>
          <div
            ref={ref}
            className={clsx(styles.layout, parent ? styles.nested : styles.surface, className)}
            data-testid={parent ? undefined : selectors.components.Panels.Visualization.Tooltip.Wrapper}
            {...otherProps}
          >
            {children}
          </div>
        </VizTooltipContext.Provider>
      </VizTooltipMenuContext.Provider>
    );
  }
);

VizTooltipWrapper.displayName = 'VizTooltipWrapper';

// Keep caller classes authoritative regardless of Emotion stylesheet insertion order.
// The universal selector prevents Emotion from adding specificity before :where().
const getStyles = (theme: GrafanaTheme2, maxWidth: number | undefined, scrollable: boolean, size: VizTooltipSize) => {
  const viewportMax = `calc(100vw - ${theme.spacing(4)})`;
  const widthLimit = maxWidth ?? (size === 'narrow' ? getNarrowMaxWidth(theme) : undefined);

  return {
    layout: css({
      '*:where(&)': {
        display: 'flex',
        flexDirection: 'column',
        fontSize: theme.typography.bodySmall.fontSize,
      },
    }),
    // Nested wrappers have no surface, so they apply the size limit on their own box.
    nested: css({
      '*:where(&)': { maxWidth: size === 'narrow' ? getNarrowMaxWidth(theme) : undefined },
    }),
    surface: css({
      '*:where(&)': {
        background: theme.colors.background.elevated,
        borderRadius: theme.shape.radius[theme.components.menu.borderRadius],
        border: theme.flags.visualDesignRefresh ? `1px solid ${theme.colors.border.weak}` : undefined,
        boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
        maxWidth: widthLimit == null ? viewportMax : `min(${widthLimit}px, ${viewportMax})`,
        maxHeight: scrollable ? `calc(100vh - ${theme.spacing(4)})` : undefined,
        overflowY: scrollable ? 'auto' : 'hidden',
        overflowX: 'hidden',
        userSelect: 'text',
      },
    }),
  };
};
