export const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

export interface AssistantOverviewProps {
  isInstalled: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isInstalling: boolean;
  canInstall: boolean;
  onInstall: () => void;
}
