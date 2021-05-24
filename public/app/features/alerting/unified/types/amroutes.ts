import { Matcher } from 'app/plugins/datasource/alertmanager/types';

export interface FormAmRoute {
  id: string;
  matchers: Matcher[];
  continue: boolean;
  receiver: string;
  groupBy: string[];
  groupWaitValue: string;
  groupWaitValueType: string;
  groupIntervalValue: string;
  groupIntervalValueType: string;
  repeatIntervalValue: string;
  repeatIntervalValueType: string;
  routes: FormAmRoute[];
}

export interface AmRouteReceiver {
  label: string;
  value: string;
}
