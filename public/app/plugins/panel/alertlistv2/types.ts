export interface StateFilter {
  firing: boolean;
  pending: boolean;
}

export interface AlertListPanelOptions {
  datasource: string[];
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  folder?: { uid: string; title: string } | null;
}
