import { type ComponentType, lazy } from 'react';

// Map of pluginId -> core React component to render when AppRootPage tries to load the plugin and fails
// (typically because the plugin isn't installed). Lets a known plugin's nav slot stay at its canonical
// /a/<pluginId> URL across install states — the URL is constant, only the renderer differs.
//
// Add an entry only when there is a corresponding navtree contribution that puts /a/<pluginId> in the
// sidebar even when the plugin isn't installed (see e.g. assistantStubNav). Without that, the fallback
// is unreachable from the nav.
export const pluginNavFallbacks: Record<string, ComponentType> = {
  'grafana-assistant-app': lazy(() => import('app/features/assistant-onboarding/AssistantOnboardingPage')),
};
