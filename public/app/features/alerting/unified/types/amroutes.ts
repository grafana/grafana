export interface AmRouteFormValues {
  matchers: Array<{
    label: string;
    value: string;
    isRegex: boolean;
  }>;
  continue: boolean;
  receiver: string;
  groupBy: Array<{
    label: string;
    value: string;
  }>;
  groupWaitValue: string;
  groupWaitValueType: string;
  groupIntervalValue: string;
  groupIntervalValueType: string;
  repeatIntervalValue: string;
  repeatIntervalValueType: string;
  routes: AmRouteFormValues[];
}
