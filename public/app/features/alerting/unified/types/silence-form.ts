import { TimeZone } from '@grafana/data';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

export type MatcherField = {
  name: string;
  value: string;
  operator: MatcherOperator;
};

export type SilenceFormFields = {
  id: string;
  startsAt: string;
  endsAt: string;
  timeZone: TimeZone;
  duration: string;
  comment: string;
  matchers: MatcherField[];
  createdBy: string;
  matcherName: string;
  matcherValue: string;
  isRegex: boolean;
};
