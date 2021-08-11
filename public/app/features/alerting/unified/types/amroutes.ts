import { MatcherField } from './silence-form';

export interface FormAmRoute {
  id: string;
  matchers: MatcherField[];
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
