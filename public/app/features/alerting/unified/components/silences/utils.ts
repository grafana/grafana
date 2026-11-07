import { DefaultTimeZone, addDurationToDate, dateTime, intervalToAbbreviatedDurationString } from '@grafana/data';
import { type SilenceFormFields } from 'app/features/alerting/unified/types/silence-form';
import { matcherToMatcherField } from 'app/features/alerting/unified/utils/alertmanager';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import {
  encodeMatcher,
  parsePromQLStyleMatcherLooseSafe,
  parseQueryParamMatchers,
} from 'app/features/alerting/unified/utils/matchers';
import { type Matcher, MatcherOperator, type Silence } from 'app/plugins/datasource/alertmanager/types';

import { contextSrv } from '../../../../../core/services/context_srv';
import { createRelativeUrl } from '../../utils/url';

/**
 * Parse query params and return default silence form values
 */
export const defaultsFromQuery = (searchParams: URLSearchParams): Partial<SilenceFormFields> => {
  const defaults: Partial<SilenceFormFields> = {};

  const comment = searchParams.get('comment');
  const matchers = searchParams.getAll('matcher');

  const searchPrefillMatchers = isSearchPrefill(searchParams) ? parseSearchPrefillMatchers(matchers) : undefined;
  let formMatchers: Matcher[];
  if (searchPrefillMatchers) {
    const ruleUid = getAlertRuleUidFromQuery(searchParams);
    formMatchers =
      ruleUid === undefined
        ? searchPrefillMatchers
        : searchPrefillMatchers.filter((matcher) => matcher.name !== MATCHER_ALERT_RULE_UID);
  } else {
    formMatchers = parseQueryParamMatchers(matchers.filter((matcher) => !matcher.startsWith(MATCHER_ALERT_RULE_UID)));
  }

  if (formMatchers.length) {
    defaults.matchers = formMatchers.map(matcherToMatcherField);
  }

  if (comment) {
    defaults.comment = comment;
  }

  return defaults;
};

export const SILENCE_PREFILL_URL_BUDGET_BYTES = 2000;
const SILENCE_PREFILL_SOURCE_PARAM = 'silencePrefill';
const SILENCE_PREFILL_SOURCE = 'search';
const PREFILLED_MATCHERS_PARAM = 'matchersPrefilled';
const TOTAL_MATCHERS_PARAM = 'matchersTotal';

export type SilencePrefillLink =
  | { status: 'ready'; href: string; prefilledMatchers: number; totalMatchers: number }
  | { status: 'cannot-fit'; totalMatchers: number };

function isSearchPrefill(searchParams: URLSearchParams): boolean {
  return searchParams.get(SILENCE_PREFILL_SOURCE_PARAM) === SILENCE_PREFILL_SOURCE;
}

function parseSearchPrefillMatchers(matchers: string[]): Matcher[] {
  return matchers
    .map((matcher) => matcher.trim())
    .filter(Boolean)
    .flatMap(parsePromQLStyleMatcherLooseSafe);
}

export function getAlertRuleUidFromQuery(searchParams: URLSearchParams): string | undefined {
  if (!isSearchPrefill(searchParams)) {
    return parseQueryParamMatchers(searchParams.getAll('matcher')).find(
      (matcher) => matcher.name === MATCHER_ALERT_RULE_UID
    )?.value;
  }

  const ruleMatchers = parseSearchPrefillMatchers(searchParams.getAll('matcher')).filter(
    (matcher) => matcher.name === MATCHER_ALERT_RULE_UID
  );
  const exactRuleMatcher = ruleMatchers[0];
  return ruleMatchers.length === 1 &&
    exactRuleMatcher.isEqual &&
    !exactRuleMatcher.isRegex &&
    exactRuleMatcher.value !== ''
    ? exactRuleMatcher.value
    : undefined;
}

function fullDestinationUrlLength(href: string): number {
  const url = new URL(href, window.location.origin);
  const orgId = contextSrv.user.orgId;
  if (Number.isFinite(orgId) && orgId > 0 && !url.searchParams.has('orgId')) {
    url.searchParams.set('orgId', String(Math.floor(orgId)));
  }
  return new TextEncoder().encode(url.href).length;
}

function silencePrefillParams(matchers: Matcher[], count: number, total: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set(SILENCE_PREFILL_SOURCE_PARAM, SILENCE_PREFILL_SOURCE);

  matchers.slice(0, count).forEach((matcher) => {
    params.append('matcher', encodeMatcher(matcherToMatcherField(matcher)));
  });

  if (count < total) {
    params.set(PREFILLED_MATCHERS_PARAM, String(count));
    params.set(TOTAL_MATCHERS_PARAM, String(total));
  }

  return params;
}

export function createSilencePrefillLink(
  alertManagerName: string | undefined,
  matchers: Matcher[]
): SilencePrefillLink {
  const totalMatchers = matchers.length;

  const buildHref = (count: number) => {
    const params = silencePrefillParams(matchers, count, totalMatchers);
    if (alertManagerName) {
      params.set('alertmanager', alertManagerName);
    }
    return createRelativeUrl('/alerting/silence/new', params);
  };

  for (let prefilledMatchers = totalMatchers; prefilledMatchers >= 0; prefilledMatchers--) {
    const href = buildHref(prefilledMatchers);
    if (fullDestinationUrlLength(href) <= SILENCE_PREFILL_URL_BUDGET_BYTES) {
      return { status: 'ready', href, prefilledMatchers, totalMatchers };
    }
  }

  return { status: 'cannot-fit', totalMatchers };
}

export interface SilencePrefillNotice {
  prefilledMatchers: number;
  totalMatchers: number;
}

function parseNonNegativeInteger(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

export function getSilencePrefillNotice(searchParams: URLSearchParams): SilencePrefillNotice | undefined {
  if (!isSearchPrefill(searchParams)) {
    return undefined;
  }

  const prefilledMatchers = parseNonNegativeInteger(searchParams.get(PREFILLED_MATCHERS_PARAM));
  const totalMatchers = parseNonNegativeInteger(searchParams.get(TOTAL_MATCHERS_PARAM));
  if (prefilledMatchers === undefined || totalMatchers === undefined) {
    return undefined;
  }
  if (prefilledMatchers < 0 || totalMatchers <= prefilledMatchers) {
    return undefined;
  }

  const carriedMatcherCount = searchParams.getAll('matcher').flatMap(parsePromQLStyleMatcherLooseSafe).length;
  if (carriedMatcherCount !== prefilledMatchers) {
    return undefined;
  }

  return { prefilledMatchers, totalMatchers };
}

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
    createdBy: isExpired ? contextSrv.user.name : silence.createdBy,
    duration: intervalToAbbreviatedDurationString(interval),
    matchers: silence.matchers?.map(matcherToMatcherField) || [],
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
    timeZone: DefaultTimeZone,
    matchers: [{ name: '', value: '', operator: MatcherOperator.equal }],
    ...partial,
  };
};
