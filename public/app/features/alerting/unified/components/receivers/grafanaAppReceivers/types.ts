import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
// we will add in here more types if needed
export enum GrafanaAppReceiverEnum {
  GRAFANA_ONCALL = 'GrafanaOnCall',
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
  GrafanaOnCall: 'public/img/alerting/oncall_logo.svg',
};

export enum GRAFANA_APP_PLUGIN_IDS {
  GrafanaOnCall = 'grafana-oncall-app',
}
