import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { TimeZone } from '@grafana/data';

export type SilenceFormFields = {
  id: string;
  startsAt: string;
  endsAt: string;
  timeZone: TimeZone;
  duration: string;
  comment: string;
  matchers: Matcher[];
  createdBy: string;
  matcherName: string;
  matcherValue: string;
  isRegex: boolean;
};
