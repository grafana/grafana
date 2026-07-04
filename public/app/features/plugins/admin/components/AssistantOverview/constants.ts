export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const ASSISTANT_ONBOARDING_PLUGIN_ID = 'grafana-assistant-onboarding-app';
export const ASSISTANT_ONBOARDING_OVERVIEW_COMPONENT_ID = `${ASSISTANT_ONBOARDING_PLUGIN_ID}/plugin-overview/v1`;

export interface AssistantOverviewProps {
  isInstalled: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isInstalling: boolean;
  canInstall: boolean;
  onInstall: () => void;
}
