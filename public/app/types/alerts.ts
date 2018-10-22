export interface Alert {
  severity: string;
  icon: string;
  title: string;
  text: string;
}

export interface AlertsState {
  alerts: Alert[];
}
