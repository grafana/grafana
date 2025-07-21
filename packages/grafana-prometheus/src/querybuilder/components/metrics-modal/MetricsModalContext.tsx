import { createContext, FC, PropsWithChildren, useContext, useState } from 'react';

type Settings = {
  useBackend: boolean;
  includeNullMetadata: boolean;
  disableTextWrap: boolean;
  hasMetadata: boolean;
  fullMetaSearch: boolean;
};

type MetricsModalContextValue = {
  settings: Settings;
  overrideSettings: (settings: Partial<Settings>) => void;
};

const MetricsModalContext = createContext<MetricsModalContextValue | undefined>(undefined);

export const MetricsModalContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    disableTextWrap: false,
    hasMetadata: true,
    includeNullMetadata: true,
    useBackend: false,
    fullMetaSearch: false,
  });

  const overrideSettings = (override: Partial<Settings>) => {
    setSettings({
      ...settings,
      ...override,
    });
  };

  return <MetricsModalContext.Provider value={{ settings, overrideSettings }}>{children}</MetricsModalContext.Provider>;
};

export function useMetricsModal() {
  const context = useContext(MetricsModalContext);
  if (context === undefined) {
    throw new Error('useMetricsModal must be used within a MetricsModalContextProvider');
  }
  return context;
}
