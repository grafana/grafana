import { StateFilterValue } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

export interface AlertHistoryOptions {
  filterTo: StateFilterValue;
  filterFrom: StateFilterValue;
  filterByLabels: string;
}
