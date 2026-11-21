import { config } from '@grafana/runtime';
import { type Matcher } from 'app/plugins/datasource/alertmanager/types';

import { MATCHER_ALERT_RULE_UID } from '../../utils/constants';
import { parseQueryParamMatchers } from '../../utils/matchers';

import {
  SILENCE_PREFILL_URL_BUDGET_BYTES,
  createSilencePrefillLink,
  defaultsFromQuery,
  getAlertRuleUidFromQuery,
  getSilencePrefillNotice,
} from './utils';

const originalAppSubUrl = config.appSubUrl;

function fullUrlLength(href: string) {
  return new TextEncoder().encode(new URL(href, window.location.origin).href).length;
}

function matcherParams(href: string) {
  return new URLSearchParams(href.split('?')[1]).getAll('matcher');
}

function readyLink(alertManagerName: string | undefined, matchers: Matcher[]) {
  const prefill = createSilencePrefillLink(alertManagerName, matchers);
  expect(prefill.status).toBe('ready');
  if (prefill.status !== 'ready') {
    throw new Error('expected a ready prefill link');
  }
  return prefill;
}

describe('createSilencePrefillLink', () => {
  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
  });

  it('carries every matcher when the whole destination fits', () => {
    const matchers: Matcher[] = [
      { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
      { name: 'env', value: 'prod.*', isRegex: true, isEqual: true },
      { name: 'team', value: 'db', isRegex: false, isEqual: false },
    ];

    const prefill = readyLink('grafana', matchers);
    const params = new URLSearchParams(prefill.href.split('?')[1]);

    expect(prefill.prefilledMatchers).toBe(3);
    expect(prefill.totalMatchers).toBe(3);
    expect(params.getAll('matcher')).toEqual(['foo="bar"', 'env=~"prod.*"', 'team!="db"']);
    expect(params.get('alertmanager')).toBe('grafana');
    expect(params.get('silencePrefill')).toBe('search');
    expect(params.has('matchersPrefilled')).toBe(false);
    expect(params.has('matchersTotal')).toBe(false);
  });

  it('carries a complete ordered prefix and reports the remainder when the destination is too long', () => {
    config.appSubUrl = '/grafana';
    const matchers: Matcher[] = Array.from({ length: 12 }, (_, index) => ({
      name: `label_${index}`,
      value: 'x'.repeat(180),
      isRegex: false,
      isEqual: true,
    }));

    const prefill = readyLink('grafana', matchers);
    const params = new URLSearchParams(prefill.href.split('?')[1]);
    const carried = params.getAll('matcher');

    expect(prefill.totalMatchers).toBe(12);
    expect(prefill.prefilledMatchers).toBe(9);
    expect(prefill.href.startsWith('/grafana/alerting/silence/new?')).toBe(true);
    expect(carried).toEqual(
      matchers.slice(0, 9).map((matcher) => {
        return `${matcher.name}="${matcher.value}"`;
      })
    );
    expect(params.get('matchersPrefilled')).toBe('9');
    expect(params.get('matchersTotal')).toBe('12');
    expect(fullUrlLength(prefill.href)).toBeLessThanOrEqual(SILENCE_PREFILL_URL_BUDGET_BYTES);
  });

  it('carries no matchers but still reports the total when not even one matcher fits', () => {
    config.appSubUrl = `/${'subpath'.repeat(258)}`;
    const matchers: Matcher[] = [{ name: 'foo', value: 'bar'.repeat(50), isRegex: false, isEqual: true }];

    const prefill = readyLink('grafana', matchers);
    const params = new URLSearchParams(prefill.href.split('?')[1]);

    expect(prefill.prefilledMatchers).toBe(0);
    expect(prefill.totalMatchers).toBe(1);
    expect(params.getAll('matcher')).toEqual([]);
    expect(params.get('matchersPrefilled')).toBe('0');
    expect(params.get('matchersTotal')).toBe('1');
    expect(fullUrlLength(prefill.href)).toBeLessThanOrEqual(SILENCE_PREFILL_URL_BUDGET_BYTES);
  });

  it('reserves the partial-prefill metadata overhead before deciding what fits', () => {
    config.appSubUrl = `/${'a'.repeat(1765)}`;
    const matchers: Matcher[] = [
      { name: 'first', value: 'x'.repeat(100), isRegex: false, isEqual: true },
      { name: 'second', value: 'y'.repeat(100), isRegex: false, isEqual: true },
    ];

    const prefill = readyLink('grafana', matchers);
    const params = new URLSearchParams(prefill.href.split('?')[1]);

    expect(prefill.prefilledMatchers).toBe(0);
    expect(prefill.totalMatchers).toBe(2);
    expect(params.getAll('matcher')).toEqual([]);
    expect(params.get('matchersPrefilled')).toBe('0');
    expect(params.get('matchersTotal')).toBe('2');
    expect(fullUrlLength(prefill.href)).toBeLessThanOrEqual(SILENCE_PREFILL_URL_BUDGET_BYTES);
  });

  it('returns an explicit cannot-fit state when even zero matchers plus the notice cannot fit', () => {
    config.appSubUrl = `/${'a'.repeat(2000)}`;
    const matchers: Matcher[] = [{ name: 'foo', value: 'bar', isRegex: false, isEqual: true }];

    const prefill = createSilencePrefillLink('grafana', matchers);

    expect(prefill).toEqual({ status: 'cannot-fit', totalMatchers: 1 });
  });

  it('round-trips matchers containing encoded special characters', () => {
    const matchers: Matcher[] = [
      { name: 'comma', value: 'a,b', isRegex: false, isEqual: true },
      { name: 'quote', value: 'say "hi"', isRegex: false, isEqual: true },
      { name: 'slash', value: 'a\\b', isRegex: false, isEqual: true },
      { name: 'space', value: 'hello world', isRegex: true, isEqual: false },
      { name: 'unicode', value: '日本語 🚨', isRegex: false, isEqual: true },
    ];

    const prefill = readyLink('grafana', matchers);

    expect(parseQueryParamMatchers(matcherParams(prefill.href))).toEqual(matchers);
    expect(prefill.href).toContain('%E6%97%A5%E6%9C%AC%E8%AA%9E');
    expect(prefill.href).toContain('%F0%9F%9A%A8');
    expect(fullUrlLength(prefill.href)).toBeLessThanOrEqual(SILENCE_PREFILL_URL_BUDGET_BYTES);
  });

  it('carries the alert rule matcher instead of silently broadening the search', () => {
    const prefill = readyLink('grafana', [
      { name: MATCHER_ALERT_RULE_UID, value: 'rule-uid', isRegex: false, isEqual: true },
      { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
    ]);

    expect(prefill.prefilledMatchers).toBe(2);
    expect(prefill.totalMatchers).toBe(2);
    expect(matcherParams(prefill.href)).toEqual(['__alert_rule_uid__="rule-uid"', 'foo="bar"']);
  });
});

describe('defaultsFromQuery', () => {
  it('keeps repeated constraints on the same label for marked search prefill links', () => {
    const defaults = defaultsFromQuery(
      new URLSearchParams([
        ['silencePrefill', 'search'],
        ['matcher', 'foo=bar'],
        ['matcher', 'foo!="baz"'],
      ])
    );

    expect(defaults.matchers).toEqual([
      { name: 'foo', operator: '=', value: 'bar' },
      { name: 'foo', operator: '!=', value: 'baz' },
    ]);
  });

  it('keeps the legacy first-label-wins behavior for unmarked links', () => {
    const defaults = defaultsFromQuery(
      new URLSearchParams([
        ['matcher', 'foo=bar'],
        ['matcher', 'foo!="baz"'],
      ])
    );

    expect(defaults.matchers).toEqual([{ name: 'foo', operator: '=', value: 'bar' }]);
  });

  it('hides a single exact alert rule UID in marked search prefill', () => {
    const searchParams = new URLSearchParams([
      ['silencePrefill', 'search'],
      ['matcher', `${MATCHER_ALERT_RULE_UID}="rule-uid"`],
      ['matcher', 'foo=bar'],
    ]);

    expect(defaultsFromQuery(searchParams).matchers).toEqual([{ name: 'foo', operator: '=', value: 'bar' }]);
    expect(getAlertRuleUidFromQuery(searchParams)).toBe('rule-uid');
  });

  it.each([
    ['empty exact', `${MATCHER_ALERT_RULE_UID}=""`, '='],
    ['not equal', `${MATCHER_ALERT_RULE_UID}!="rule-uid"`, '!='],
    ['regex', `${MATCHER_ALERT_RULE_UID}=~"rule-.*"`, '=~'],
    ['not regex', `${MATCHER_ALERT_RULE_UID}!~"rule-.*"`, '!~'],
  ])('keeps a marked search alert rule UID as an editable %s matcher', (_label, matcher, operator) => {
    const searchParams = new URLSearchParams([
      ['silencePrefill', 'search'],
      ['matcher', matcher],
    ]);

    expect(defaultsFromQuery(searchParams).matchers).toEqual([
      { name: MATCHER_ALERT_RULE_UID, operator, value: matcher.split(operator)[1].replace(/^"/, '').replace(/"$/, '') },
    ]);
    expect(getAlertRuleUidFromQuery(searchParams)).toBeUndefined();
  });

  it('keeps multiple marked search alert rule UID clauses as editable matchers', () => {
    const searchParams = new URLSearchParams([
      ['silencePrefill', 'search'],
      ['matcher', `${MATCHER_ALERT_RULE_UID}="first-rule"`],
      ['matcher', `${MATCHER_ALERT_RULE_UID}="second-rule"`],
    ]);

    expect(defaultsFromQuery(searchParams).matchers).toEqual([
      { name: MATCHER_ALERT_RULE_UID, operator: '=', value: 'first-rule' },
      { name: MATCHER_ALERT_RULE_UID, operator: '=', value: 'second-rule' },
    ]);
    expect(getAlertRuleUidFromQuery(searchParams)).toBeUndefined();
  });

  it('keeps the legacy alert rule UID behavior for unmarked links', () => {
    const searchParams = new URLSearchParams([
      ['matcher', `${MATCHER_ALERT_RULE_UID}!="rule-uid"`],
      ['matcher', 'foo=bar'],
    ]);

    expect(defaultsFromQuery(searchParams).matchers).toEqual([{ name: 'foo', operator: '=', value: 'bar' }]);
    expect(getAlertRuleUidFromQuery(searchParams)).toBe('rule-uid');
  });
});

describe('getSilencePrefillNotice', () => {
  it('returns the counts for a partial prefill that matches the carried matchers', () => {
    const notice = getSilencePrefillNotice(
      new URLSearchParams([
        ['silencePrefill', 'search'],
        ['matcher', 'foo="bar"'],
        ['matchersPrefilled', '1'],
        ['matchersTotal', '3'],
      ])
    );

    expect(notice).toEqual({ prefilledMatchers: 1, totalMatchers: 3 });
  });

  it('returns nothing when every matcher was carried', () => {
    const notice = getSilencePrefillNotice(
      new URLSearchParams([
        ['silencePrefill', 'search'],
        ['matcher', 'foo="bar"'],
        ['matchersPrefilled', '1'],
        ['matchersTotal', '1'],
      ])
    );

    expect(notice).toBeUndefined();
  });

  it('returns nothing when either count is missing or malformed', () => {
    const base = [
      ['silencePrefill', 'search'],
      ['matcher', 'foo="bar"'],
    ];

    expect(getSilencePrefillNotice(new URLSearchParams([...base, ['matchersTotal', '3']]))).toBeUndefined();
    expect(getSilencePrefillNotice(new URLSearchParams([...base, ['matchersPrefilled', '1']]))).toBeUndefined();
    expect(
      getSilencePrefillNotice(new URLSearchParams([...base, ['matchersPrefilled', 'nope'], ['matchersTotal', '3']]))
    ).toBeUndefined();
  });

  it('returns nothing when the metadata does not match the carried matchers', () => {
    const notice = getSilencePrefillNotice(
      new URLSearchParams([
        ['silencePrefill', 'search'],
        ['matcher', 'foo="bar"'],
        ['matchersPrefilled', '0'],
        ['matchersTotal', '3'],
      ])
    );

    expect(notice).toBeUndefined();
  });
});
