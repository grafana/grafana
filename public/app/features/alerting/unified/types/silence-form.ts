import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';

export type SilenceFormFields = {
  id: string;
  startsAt: string;
  endsAt: string;
  duration: string;
  comment: string;
  matchers: SilenceMatcher[];
  createdBy: string;
  matcherName: string;
  matcherValue: string;
  isRegex: boolean;
};
