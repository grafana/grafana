import { StateFilterValue } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

export interface AlertHistoryOptions {
  hideEventsList: boolean;
  hideEventsGraph: boolean;
  filterTo: StateFilterValue;
  filterFrom: StateFilterValue;
}
