import { createContext, useContext } from 'react';

/** The consuming app, separate from the plugin that owns an exposed component. */
export const ExposedComponentOriginContext = createContext<string | undefined>(undefined);

export function useExposedComponentOriginPluginId() {
  return useContext(ExposedComponentOriginContext);
}
