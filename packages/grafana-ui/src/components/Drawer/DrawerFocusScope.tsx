import { createContext, type MutableRefObject, type ReactNode, useLayoutEffect, useRef, useState } from 'react';

export const DrawerReturnFocusContext = createContext<MutableRefObject<HTMLElement | null> | undefined>(undefined);

/** Keep one return-focus target while a loading drawer is replaced by its content. */
export function DrawerFocusScope({ children }: { children: ReactNode }) {
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const returnFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    returnFocus.current = null;
    return () => {
      // Parent layout cleanup runs before the drawer's focus-manager cleanup. Only the
      // entire scope closing should return focus, not a drawer replacement within it.
      returnFocus.current = opener;
    };
  }, [opener]);

  return <DrawerReturnFocusContext.Provider value={returnFocus}>{children}</DrawerReturnFocusContext.Provider>;
}
