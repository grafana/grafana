import { locationService } from '@grafana/runtime';

import { type Hint } from './liveScenario';
import { NO_SCOPE_QUERY, hintIdFromQuery, scopeFromQuery, scopeQuery } from './scopeUrl';

const hint: Hint = {
  id: 'errors-checkout',
  severity: 'errors',
  title: 'checkout errors up',
  description: 'span_errors on checkout',
  scope: { type: 'service', value: 'checkout' },
  investigable: true,
  trendLabel: 'errors',
  trend: [1, 2, 3],
  evidence: [],
  timeRange: { from: 1_700_000_000_000, to: 1_700_001_800_000 },
};

describe('scopeFromQuery', () => {
  it.each([
    { type: 'service', value: 'checkout' },
    { type: 'environment', value: 'prod-us-east-0' },
    { type: 'namespace', value: 'payments' },
  ])('reads a $type scope', ({ type, value }) => {
    expect(scopeFromQuery({ 'scope-type': type, 'scope-value': value })).toEqual({ type, value });
  });

  it.each([
    { name: 'a type the page does not know', query: { 'scope-type': 'cluster', 'scope-value': 'a' } },
    { name: 'no type', query: { 'scope-value': 'a' } },
    { name: 'no value', query: { 'scope-type': 'service' } },
    { name: 'an empty value', query: { 'scope-type': 'service', 'scope-value': '' } },
    { name: 'a value with no text after the name', query: { 'scope-type': 'service', 'scope-value': true } },
    { name: 'a repeated value', query: { 'scope-type': 'service', 'scope-value': ['a', 'b'] } },
    { name: 'a repeated type', query: { 'scope-type': ['service', 'namespace'], 'scope-value': 'a' } },
  ])('reads $name as no scope', ({ query }) => {
    expect(scopeFromQuery(query)).toBeUndefined();
  });
});

describe('hintIdFromQuery', () => {
  it('reads the hint id', () => {
    expect(hintIdFromQuery({ hint: 'errors-checkout' })).toBe('errors-checkout');
  });

  it.each([{ hint: undefined }, { hint: '' }, { hint: true }, { hint: ['a', 'b'] }])(
    'reads $hint as no hint',
    ({ hint: value }) => {
      expect(hintIdFromQuery({ hint: value })).toBeUndefined();
    }
  );
});

describe('scopeQuery', () => {
  it('names the scope and the hint', () => {
    expect(scopeQuery(hint.scope, hint)).toEqual({
      'scope-type': 'service',
      'scope-value': 'checkout',
      hint: 'errors-checkout',
    });
  });

  it('removes the hint of the scope before when the new scope has none', () => {
    expect(scopeQuery({ type: 'service', value: 'checkout' })).toEqual({
      'scope-type': 'service',
      'scope-value': 'checkout',
      hint: null,
    });
  });
});

describe('a scope kept in the URL', () => {
  beforeEach(() => {
    locationService.replace('/drilldown?var-ds-metrics=prom');
  });

  it.each(['checkout', '::1', 'a b&c=d', 'ünï', '100%', 'x+y', 'a/b?c#d'])('comes back as written for %s', (value) => {
    locationService.partial(scopeQuery({ type: 'service', value }, hint));

    expect(scopeFromQuery(locationService.getSearchObject())).toEqual({ type: 'service', value });
    expect(hintIdFromQuery(locationService.getSearchObject())).toBe('errors-checkout');
    expect(locationService.getSearchObject()['var-ds-metrics']).toBe('prom');
  });

  it('is removed together with its hint, and leaves the data sources', () => {
    locationService.partial(scopeQuery(hint.scope, hint));

    locationService.partial(NO_SCOPE_QUERY);

    expect(locationService.getSearchObject()).toEqual({ 'var-ds-metrics': 'prom' });
  });
});
