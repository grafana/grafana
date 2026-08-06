import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface AssistantDifyIframeContextType {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  iframeReloadKey: number;
  reloadIframe: () => void;
}

const AssistantDifyIframeContext = createContext<AssistantDifyIframeContextType>({
  isOpen: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  toggleAssistant: () => {},
  iframeReloadKey: 0,
  reloadIframe: () => {},
});

export function useAssistantDifyIframeContext() {
  return useContext(AssistantDifyIframeContext);
}

export function AssistantDifyIframeContextProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [iframeReloadKey, setIframeReloadKey] = useState(0);

  const openAssistant = useCallback(() => setIsOpen(true), []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const toggleAssistant = useCallback(() => setIsOpen((v) => !v), []);
  const reloadIframe = useCallback(() => setIframeReloadKey((k) => k + 1), []);

  return (
    <AssistantDifyIframeContext.Provider
      value={{
        isOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        iframeReloadKey,
        reloadIframe,
      }}
    >
      {children}
    </AssistantDifyIframeContext.Provider>
  );
}
