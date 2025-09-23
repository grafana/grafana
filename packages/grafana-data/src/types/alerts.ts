/**
 * @internal
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
 * @internal
 */
export interface AlertStateInfo {
  id: number;
  dashboardId: number;
  panelId: number;
  state: AlertState;
}
