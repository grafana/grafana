import { clamp } from 'lodash';
import React, { useCallback } from 'react';

export type SidebarPosition = 'left' | 'right';

export interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact?: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  paneWidth?: number;
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
  compact?: boolean;
}

export function useSiderbar({
  hasOpenPane: isPaneOpen,
  position = 'right',
  tabsMode,
  compact = true,
}: UseSideBarOptions): SidebarContextValue {
  const [isDocked, setIsDocked] = React.useState(false);
  const [paneWidth, setPaneWidth] = React.useState(280);

  const onDockChange = useCallback(() => setIsDocked((prev) => !prev), []);

  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth = (compact ? 40 : 65) + 16 * 2; // button width + padding

  const outerWrapperProps = {
    style: {
      [prop]: isDocked && isPaneOpen ? paneWidth + toolbarWidth : toolbarWidth,
    },
  };

  const onResize = useCallback((diff: number) => {
    console.log('resizing sidebar by', diff);
    setPaneWidth((prevWidth) => {
      return clamp(prevWidth + diff, 100, 500);
    });
  }, []);

  return {
    isDocked,
    onDockChange,
    onResize,
    outerWrapperProps,
    position,
    compact,
    hasOpenPane: isPaneOpen,
    tabsMode,
    paneWidth,
  };
}
