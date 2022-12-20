import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
// we will add in here more types if needed
export enum GrafanaAppReceiverEnum {
  GRAFANA_ONCALL = 'Grafana OnCall',
}

export interface AmRouteReceiver {
  label: string;
  value: string;
  grafanaAppReceiverType?: GrafanaAppReceiverEnum;
}

export interface ReceiverWithTypes extends Receiver {
  grafanaAppReceiverType?: GrafanaAppReceiverEnum;
}

export const GRAFANA_APP_RECEIVERS_SOURCE_IMAGE = {
  'Grafana OnCall': 'public/img/alerting/oncall_logo.svg',
};

export enum GRAFANA_APP_PLUGIN_IDS {
  'Grafana OnCall' = 'grafana-oncall-app',
}
