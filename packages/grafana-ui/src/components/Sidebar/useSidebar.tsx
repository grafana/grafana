import { clamp } from 'lodash';
import React, { useCallback } from 'react';

export type SidebarPosition = 'left' | 'right';

export interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps: React.HTMLAttributes<HTMLDivElement>;
  paneWidth: number;
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
}

export function useSiderbar({
  hasOpenPane,
  position = 'right',
  tabsMode,
  compactDefault = true,
}: UseSideBarOptions): SidebarContextValue {
  const [isDocked, setIsDocked] = React.useState(false);
  const [paneWidth, setPaneWidth] = React.useState(280);
  const [compact, setCompact] = React.useState(compactDefault);
  // Used to accumulate drag distance to know when to change compact mode
  const [_, setCompactDrag] = React.useState(0);

  const onDockChange = useCallback(() => setIsDocked((prev) => !prev), []);

  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth = (compact ? 40 : 68) + 16; // button width + padding

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
  };
}
