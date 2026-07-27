import { createContext, useContext, type ComponentType } from 'react';

export interface BrandingContextValue {
  /**
   * Logo used by full-page loaders (e.g. PageLoader). Grafana core supplies a value that
   * reflects custom branding; when unset (e.g. grafana-ui used standalone) components fall
   * back to the default Grafana icon.
   */
  AppLogo?: ComponentType<{ className?: string }>;
}

// Optional by design: the empty default means no provider is required, so grafana-ui keeps
// working when used outside Grafana core.
export const BrandingContext = createContext<BrandingContextValue>({});

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
