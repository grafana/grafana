/**
 * TBD
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
 * TBD
 */
export interface AlertStateInfo {
  id: number;
  dashboardId: number;
  panelId: number;
  state: AlertState;
  newStateDate: string;
}
