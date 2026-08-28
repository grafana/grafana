import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';

import { type SidebarPosition } from '@grafana/ui';

export type SidebarShiftPadding = number | { left: number } | { right: number };

export type EditActionsLayout = {
  getPortalRoot: () => HTMLElement | undefined;
  getSidebarShiftPadding: () => SidebarShiftPadding;
};

const defaultLayout: EditActionsLayout = {
  getPortalRoot: () => undefined,
  getSidebarShiftPadding: () => 0,
};

const EditActionsLayoutContext = createContext<EditActionsLayout>(defaultLayout);

export const useEditActionsLayout = () => useContext(EditActionsLayoutContext);

export function measureSidebarShiftPadding(
  container: HTMLElement | null | undefined,
  sidebar: HTMLElement | null | undefined,
  position: SidebarPosition
) {
  if (!container || !sidebar) {
    return 0;
  }

  const containerRect = container.getBoundingClientRect();
  const sidebarRect = sidebar.getBoundingClientRect();
  return position === 'left'
    ? { left: Math.max(0, sidebarRect.right - containerRect.left) }
    : { right: Math.max(0, containerRect.right - sidebarRect.left) };
}

export function EditActionsLayoutProvider({
  containerRef,
  isDocked,
  isHidden,
  sidebarPosition,
  children,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  isDocked: boolean;
  isHidden: boolean;
  sidebarPosition: SidebarPosition;
  children: ReactNode;
}) {
  // Keep the context value identity stable so panels do not re-render on dock or resize.
  const sidebarLayoutRef = useRef({ isDocked, isHidden, sidebarPosition });
  sidebarLayoutRef.current = { isDocked, isHidden, sidebarPosition };

  const layout = useMemo<EditActionsLayout>(
    () => ({
      getPortalRoot: () => containerRef.current ?? undefined,
      getSidebarShiftPadding: () => {
        const { isDocked: docked, isHidden: hidden, sidebarPosition: position } = sidebarLayoutRef.current;
        if (docked || hidden) {
          return 0;
        }

        return measureSidebarShiftPadding(containerRef.current, document.getElementById('sidebar-container'), position);
      },
    }),
    [containerRef]
  );

  return <EditActionsLayoutContext.Provider value={layout}>{children}</EditActionsLayoutContext.Provider>;
}
