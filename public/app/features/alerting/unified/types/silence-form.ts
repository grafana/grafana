import { TimeZone } from '@grafana/data';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

export type MatcherFieldValue = {
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
  matchers: MatcherFieldValue[];
  createdBy: string;
  matcherName: string;
  matcherValue: string;
  isRegex: boolean;
};
