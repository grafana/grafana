import { SelectableValue } from '@grafana/data';

export interface AmRouteFormValues {
  matchers: Array<{
    label: string;
    value: string;
    isRegex: boolean;
  }>;
  continue: boolean;
  receiver: SelectableValue<string> | undefined;
  groupBy: Array<{
    label: string;
    value: string;
  }>;
  groupWaitValue: string;
  groupWaitValueType: SelectableValue<string>;
  groupIntervalValue: string;
  groupIntervalValueType: SelectableValue<string>;
  repeatIntervalValue: string;
  repeatIntervalValueType: SelectableValue<string>;
  routes: AmRouteFormValues[];
}
