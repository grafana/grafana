import { MatcherFieldValue } from './silence-form';

export interface FormAmRoute {
  id: string;
  object_matchers: MatcherFieldValue[];
  continue: boolean;
  receiver: string;
  groupBy: string[];
  groupWaitValue: string;
  groupWaitValueType: string;
  groupIntervalValue: string;
  groupIntervalValueType: string;
  repeatIntervalValue: string;
  repeatIntervalValueType: string;
  muteTimeIntervals: string[];
  routes: FormAmRoute[];
}

export interface AmRouteReceiver {
  label: string;
  value: string;
}
