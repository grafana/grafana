import { MatcherFieldValue } from './silence-form';
export interface FormAmRoute {
  id: string;
  object_matchers: MatcherFieldValue[];
  continue: boolean;
  receiver: string;
  enrichments?: Record<string, string>;
  overrideGrouping: boolean;
  groupBy?: string[];
  overrideTimings: boolean;
  groupWaitValue: string;
  groupIntervalValue: string;
  repeatIntervalValue: string;
  muteTimeIntervals: string[];
  routes: FormAmRoute[];
}
