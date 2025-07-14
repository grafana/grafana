// TODO This value needs to be changed to grafana_alerting when the OnCall team introduces the necessary changes
export const GRAFANA_ONCALL_INTEGRATION_TYPE = 'grafana_alerting';

export enum ReceiverTypes {
  OnCall = 'oncall',
}

export const isInOnCallIntegrations = (url: string, integrationsUrls: string[]) => {
  return integrationsUrls.includes(url);
};
