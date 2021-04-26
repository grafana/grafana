/**
 * @internal -- might be replaced by next generation Alerting
 */
export enum AlertState {
  NoData = 'no_data',
  Paused = 'paused',
  Alerting = 'alerting',
  OK = 'ok',
  Pending = 'pending',
  Unknown = 'unknown',
}

/**
 * @internal -- might be replaced by next generation Alerting
 */
export interface AlertStateInfo {
  id: number;
  dashboardId: number;
  panelId: number;
  state: AlertState;
  newStateDate: string;
}
