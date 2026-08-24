import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';

export type EditActionsLayout = {
  getPortalRoot: () => HTMLElement | undefined;
  getSidebarShiftPadding: () => number | { right: number };
};

const defaultLayout: EditActionsLayout = {
  getPortalRoot: () => undefined,
  getSidebarShiftPadding: () => 0,
};

const EditActionsLayoutContext = createContext<EditActionsLayout>(defaultLayout);

export const useEditActionsLayout = () => useContext(EditActionsLayoutContext);

export function measureSidebarShiftPadding(
  canvas: HTMLElement | null | undefined,
  sidebar: HTMLElement | null | undefined
) {
  if (!canvas || !sidebar) {
    return 0;
  }

  return { right: Math.max(0, canvas.getBoundingClientRect().right - sidebar.getBoundingClientRect().left) };
}

export function EditActionsLayoutProvider({
  canvasRef,
  isDocked,
  isHidden,
  children,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  isDocked: boolean;
  isHidden: boolean;
  children: ReactNode;
}) {
  // Keep the context value identity stable so panels do not re-render on dock or resize.
  const sidebarLayoutRef = useRef({ isDocked, isHidden });
  sidebarLayoutRef.current = { isDocked, isHidden };

  const layout = useMemo<EditActionsLayout>(
    () => ({
      getPortalRoot: () => canvasRef.current ?? undefined,
      getSidebarShiftPadding: () => {
        const { isDocked: docked, isHidden: hidden } = sidebarLayoutRef.current;
        if (docked || hidden) {
          return 0;
        }

        return measureSidebarShiftPadding(canvasRef.current, document.getElementById('sidebar-container'));
      },
    }),
    [canvasRef]
  );

  return <EditActionsLayoutContext.Provider value={layout}>{children}</EditActionsLayoutContext.Provider>;
}
