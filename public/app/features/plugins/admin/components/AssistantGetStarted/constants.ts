import { type OpenAssistantProps } from '@grafana/assistant';

/** Plugin ID constant — also used in PluginDetailsBody.tsx and usePluginDetailsTabs.tsx */
export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

/**
 * ID of the connect component the Assistant plugin exposes via `AppPlugin.exposeComponent()`.
 * When present it replaces the static Cloud sign-up link in step 2 with the plugin's real
 * connection flow. The string must stay in sync with the plugin's `exposeComponent({ id })` call.
 */
export const ASSISTANT_CONNECT_COMPONENT_ID = 'grafana-assistant-app/connect/v1';

export const CLOUD_SIGNUP_URL =
  'https://grafana.com/auth/sign-up/?utm_source=grafana_oss&utm_medium=onprem_assistant&utm_campaign=assistant_onboarding&cta=connect_step2';

/** Props passed to the exposed connect component. Kept in sync with the plugin side. */
export interface AssistantConnectComponentProps {
  /** Invoked by the plugin once the instance is successfully connected to Grafana Cloud. */
  onConnected?: () => void;
}

export type SetupState = 'not-installed' | 'reloading' | 'loading' | 'not-connected' | 'connected';
export type AssistantOpenOverrides = Omit<Partial<OpenAssistantProps>, 'origin'>;
