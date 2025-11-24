import { clamp } from 'lodash';
import React, { useCallback } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

export type SidebarPosition = 'left' | 'right';

export interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps: React.HTMLAttributes<HTMLDivElement>;
  paneWidth: number;
  bottomMargin: number;
  edgeMargin: number;
  contentMargin: number;
  onDockChange: () => void;
  onResize: (diff: number) => void;
}

export const SidebarContext: React.Context<SidebarContextValue | undefined> = React.createContext<
  SidebarContextValue | undefined
>(undefined);

export interface UseSideBarOptions {
  hasOpenPane?: boolean;
  position?: SidebarPosition;
  tabsMode?: boolean;
  compactDefault?: boolean;
  /** defaults to 2 grid units (16px) */
  bottomMargin?: number;
  /** defaults to 2 grid units (16px) */
  edgeMargin?: number;
  /** defaults to 2 grid units (16px) */
  contentMargin?: number;
}

export const SIDE_BAR_WIDTH_ICON_ONLY = 5;
export const SIDE_BAR_WIDTH_WITH_TEXT = 8;

export function useSidebar({
  hasOpenPane,
  position = 'right',
  tabsMode,
  compactDefault = true,
  bottomMargin = 2,
  edgeMargin = 2,
  contentMargin = 2,
}: UseSideBarOptions): SidebarContextValue {
  const theme = useTheme2();
  const [isDocked, setIsDocked] = React.useState(false);
  const [paneWidth, setPaneWidth] = React.useState(280);
  const [compact, setCompact] = React.useState(compactDefault);
  // Used to accumulate drag distance to know when to change compact mode
  const [_, setCompactDrag] = React.useState(0);

  const onDockChange = useCallback(() => setIsDocked((prev) => !prev), []);

  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth =
    ((compact ? SIDE_BAR_WIDTH_ICON_ONLY : SIDE_BAR_WIDTH_WITH_TEXT) + edgeMargin + contentMargin) *
    theme.spacing.gridSize;

  const outerWrapperProps = {
    style: {
      [prop]: isDocked && hasOpenPane ? paneWidth + toolbarWidth : toolbarWidth,
    },
  };

  const onResize = useCallback(
    (diff: number) => {
      setPaneWidth((prevWidth) => {
        // If no pane is open we use the resize action to toggle compact mode (button text visibility)
        if (!hasOpenPane) {
          setCompactDrag((prevDrag) => {
            const newDrag = prevDrag + diff;
            if (newDrag < -20 && !compact) {
              setCompact(true);
              return 0;
            } else if (newDrag > 20 && compact) {
              setCompact(false);
              return 0;
            }

            return newDrag;
          });

          return prevWidth;
        }

        return clamp(prevWidth + diff, 100, 500);
      });
    },
    [hasOpenPane, compact]
  );

  return {
    isDocked,
    onDockChange,
    onResize,
    outerWrapperProps,
    position,
    compact,
    hasOpenPane,
    tabsMode,
    paneWidth,
    edgeMargin,
    bottomMargin,
    contentMargin,
  };
}
