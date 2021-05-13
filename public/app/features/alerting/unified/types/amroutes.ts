export interface ArrayFieldMatcher {
  label: string;
  value: string;
  isRegex: boolean;
}

export interface FormAmRoute {
  matchers: ArrayFieldMatcher[];
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
