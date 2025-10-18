import { DefaultTimeZone, addDurationToDate, dateTime, intervalToAbbreviatedDurationString } from '@grafana/data';
import { SilenceFormFields } from 'app/features/alerting/unified/types/silence-form';
import { matcherToMatcherField } from 'app/features/alerting/unified/utils/alertmanager';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { parseQueryParamMatchers } from 'app/features/alerting/unified/utils/matchers';
import { MatcherOperator, Silence } from 'app/plugins/datasource/alertmanager/types';

import { contextSrv } from '../../../../../core/services/context_srv';

/**
 * Parse query params and return default silence form values
 */
export const defaultsFromQuery = (searchParams: URLSearchParams): Partial<SilenceFormFields> => {
  const defaults: Partial<SilenceFormFields> = {};

  const comment = searchParams.get('comment');
  const matchers = searchParams.getAll('matcher');

  const strippedMatchers = matchers.filter((m) => !m.startsWith(MATCHER_ALERT_RULE_UID));

  const formMatchers = parseQueryParamMatchers(strippedMatchers);
  if (formMatchers.length) {
    defaults.matchers = formMatchers.map(matcherToMatcherField);
  }

  if (comment) {
    defaults.comment = comment;
  }

  return defaults;
};

/**
 *
 */
export const getFormFieldsForSilence = (silence: Silence): SilenceFormFields => {
  const now = new Date();
  const isExpired = Date.parse(silence.endsAt) < Date.now();
  const interval = isExpired
    ? {
        start: now,
        end: addDurationToDate(now, { hours: 2 }),
      }
    : { start: new Date(silence.startsAt), end: new Date(silence.endsAt) };
  return {
    id: silence.id,
    startsAt: interval.start.toISOString(),
    endsAt: interval.end.toISOString(),
    comment: silence.comment,
    createdBy: silence.createdBy,
    duration: intervalToAbbreviatedDurationString(interval),
    isRegex: false,
    matchers: silence.matchers?.map(matcherToMatcherField) || [],
    matcherName: '',
    matcherValue: '',
    timeZone: DefaultTimeZone,
  };
};

/**
 * Generate default silence form values
 */
export const getDefaultSilenceFormValues = (partial?: Partial<SilenceFormFields>): SilenceFormFields => {
  const now = new Date();

  const endsAt = addDurationToDate(now, { hours: 2 }); // Default time period is now + 2h
  return {
    id: '',
    startsAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    comment: `created ${dateTime().format('YYYY-MM-DD HH:mm')}`,
    createdBy: contextSrv.user.name,
    duration: '2h',
    isRegex: false,
    matcherName: '',
    matcherValue: '',
    timeZone: DefaultTimeZone,
    matchers: [{ name: '', value: '', operator: MatcherOperator.equal }],
    ...partial,
  };
};
