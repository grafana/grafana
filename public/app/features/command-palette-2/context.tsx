import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface CommandPaletteContextGlobalState {
  isActive: boolean;
}

interface CommandPaletteContext {
  state: CommandPaletteContextGlobalState;
  toggle(): void;
}

const context = createContext<CommandPaletteContext | undefined>(undefined);

export function useCommandPalette() {
  const contextValue = useContext(context);

  if (!contextValue) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }

  return contextValue;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);

  const state: CommandPaletteContextGlobalState = useMemo(() => {
    return {
      isActive,
    };
  }, [isActive]);

  const toggle = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActive(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isActive]);

  const value: CommandPaletteContext = useMemo(() => {
    return {
      state,
      toggle,
    };
  }, [state, toggle]);

  return <context.Provider value={value}>{children}</context.Provider>;
}
