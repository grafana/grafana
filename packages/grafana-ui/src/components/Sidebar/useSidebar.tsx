import React from 'react';

export type SidebarPosition = 'left' | 'right';

export interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact?: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  onDockChange: () => void;
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

  const onDockChange = () => setIsDocked(!isDocked);

  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth = (compact ? 40 : 65) + 16 * 2; // button width + padding

  const outerWrapperProps = {
    style: {
      [prop]: isDocked && isPaneOpen ? '350px' : `${toolbarWidth}px`,
    },
  };

  return { isDocked, onDockChange, outerWrapperProps, position, compact, hasOpenPane: isPaneOpen, tabsMode };
}
