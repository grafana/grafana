export interface DeclareIncidentDrilldownPayload {
  incidentURL: string;
  pluginId: string;
  defaultTitle?: string;
}

export const DEFAULT_DECLARE_INCIDENT_PLUGIN_ID = 'grafana-irm-app';
