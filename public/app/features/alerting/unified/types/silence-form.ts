import { type TimeZone } from '@grafana/data';
import { type MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

/**
 * API-neutral reference to the alert rule being silenced. Callers pass whatever they already have
 * on hand instead of the silence UI fetching the rule itself - title/folderUid are optional because
 * some flows (e.g. a bare rule UID from a URL) don't have them available.
 */
export type RuleReference = {
  uid: string;
  title?: string;
  folderUid?: string;
};

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
