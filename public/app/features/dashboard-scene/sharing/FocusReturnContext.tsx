import { createContext, useContext, useRef, ReactNode } from 'react';

/**
 * Context for storing a reference to the element that triggered an overlay (drawer, modal, etc.).
 * Used to restore focus when the overlay closes (WCAG 2.4.3 Focus Order).
 * See: https://github.com/grafana/grafana/issues/117835
 */
interface FocusReturnContextValue {
  /** Ref to attach to the trigger element - when the overlay closes, focus returns here */
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const FocusReturnContext = createContext<FocusReturnContextValue | undefined>(undefined);

export function FocusReturnProvider({ children }: { children: ReactNode }) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const value: FocusReturnContextValue = {
    triggerRef,
  };

  return <FocusReturnContext.Provider value={value}>{children}</FocusReturnContext.Provider>;
}

export function useFocusReturn() {
  const context = useContext(FocusReturnContext);
  return context;
}
