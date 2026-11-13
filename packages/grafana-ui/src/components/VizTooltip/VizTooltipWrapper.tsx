import { css } from '@emotion/css';
import clsx from 'clsx';
import React, { createContext, forwardRef, useContext, type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { type MenuProps } from '../Menu/Menu';

type TooltipMenuProps = Pick<MenuProps, 'autoFocus' | 'onOpen' | 'onClose' | 'onKeyDownCapture'>;

/** @internal */
export const VizTooltipContext = createContext<{ menuProps?: TooltipMenuProps } | undefined>(undefined);

/** @alpha */
export interface VizTooltipWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** Callbacks and focus behavior for the footer's data link menu. */
  menuProps?: TooltipMenuProps;
  /** Maximum surface width in pixels, also constrained to the viewport. */
  maxWidth?: number;
  /** Whether the surface constrains its height and scrolls overflowing content. */
  scrollable?: boolean;
}

/** @alpha */
export const VizTooltipWrapper = forwardRef<HTMLDivElement, VizTooltipWrapperProps>(
  ({ children, className, menuProps, maxWidth, scrollable = true, ...otherProps }, ref) => {
    const styles = useStyles2(getStyles, maxWidth, scrollable);
    const parent = useContext(VizTooltipContext);

    return (
      <VizTooltipContext.Provider value={{ menuProps: menuProps ?? parent?.menuProps }}>
        <div
          ref={ref}
          className={clsx(styles.layout, !parent && styles.surface, className)}
          data-testid={parent ? undefined : selectors.components.Panels.Visualization.Tooltip.Wrapper}
          {...otherProps}
        >
          {children}
        </div>
      </VizTooltipContext.Provider>
    );
  }
);

VizTooltipWrapper.displayName = 'VizTooltipWrapper';

// Keep caller classes authoritative regardless of Emotion stylesheet insertion order.
// The universal selector prevents Emotion from adding specificity before :where().
const getStyles = (theme: GrafanaTheme2, maxWidth: number | undefined, scrollable: boolean) => ({
  layout: css({
    '*:where(&)': {
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.bodySmall.fontSize,
    },
  }),
  surface: css({
    '*:where(&)': {
      background: theme.colors.background.elevated,
      borderRadius: theme.shape.radius[theme.components.menu.borderRadius],
      border: theme.flags.visualDesignRefresh ? `1px solid ${theme.colors.border.weak}` : undefined,
      boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
      maxWidth:
        maxWidth == null
          ? `calc(100vw - ${theme.spacing(4)})`
          : `min(${maxWidth}px, calc(100vw - ${theme.spacing(4)}))`,
      maxHeight: scrollable ? `calc(100vh - ${theme.spacing(4)})` : undefined,
      overflowY: scrollable ? 'auto' : 'hidden',
      overflowX: 'hidden',
      userSelect: 'text',
    },
  }),
});
