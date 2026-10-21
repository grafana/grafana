import { type SearchQuery } from '../rule-search/searchQueryLeaves';

import { getRuleSearchQueryViolations } from './ruleSearchQueryContract';

function queryWith(where: SearchQuery['where']): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    where,
    sort: [{ field: 'title', direction: 'asc' }],
    fields: ['title'],
    limit: 40,
  };
}

describe('getRuleSearchQueryViolations', () => {
  it('reports NotIn on paused, which the rule search rejects', () => {
    const query = queryWith({ filter: { field: 'paused', operator: 'NotIn', values: ['true'] } });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual(['NotIn is not accepted on paused']);
  });

  it('reports a notificationType NotIn leaf with two values', () => {
    const query = queryWith({
      filter: { field: 'notificationType', operator: 'NotIn', values: ['SimplifiedRouting', 'NamedRoutingTree'] },
    });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([
      'NotIn is not accepted on notificationType',
      'notificationType accepts exactly one value',
    ]);
  });

  it('reports the same field filtered twice and a wildcard value', () => {
    const query = queryWith({
      and: [
        { filter: { field: 'folder', operator: 'In', values: ['a*'] } },
        { filter: { field: 'folder', operator: 'In', values: ['b'] } },
      ],
    });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([
      'folder values must be non-empty and free of wildcards',
      'folder is filtered more than once',
    ]);
  });

  it('accepts a labels regex leaf and a single text leaf', () => {
    const query = queryWith({
      and: [{ text: { value: 'cpu' } }, { regex: { field: 'labels', pattern: 'team=api.*' } }],
    });
    expect(getRuleSearchQueryViolations(query, 'recording')).toEqual([]);
  });

  it('accepts the capitalised state and health values on an Alert rule search', () => {
    const query = queryWith({
      and: [
        { filter: { field: 'state', operator: 'In', values: ['Healthy', 'Inactive'] } },
        { filter: { field: 'health', operator: 'In', values: ['NoData'] } },
      ],
    });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([]);
  });

  it('reports a lower-case state value, which the store never matches', () => {
    const query = queryWith({ filter: { field: 'state', operator: 'In', values: ['firing'] } });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([
      'state values must be one of Inactive, Healthy, Firing, Pending, Recovering',
    ]);
  });

  it('reports state on a Recording rule search, which the API rejects as an unknown field', () => {
    const query = queryWith({ filter: { field: 'state', operator: 'In', values: ['Firing'] } });
    expect(getRuleSearchQueryViolations(query, 'recording')).toEqual(['filtering on state is not accepted']);
  });

  it('accepts Recording as a health value only on a Recording rule search', () => {
    const query = queryWith({ filter: { field: 'health', operator: 'In', values: ['Recording'] } });
    expect(getRuleSearchQueryViolations(query, 'recording')).toEqual([]);
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([
      'health values must be one of Unknown, OK, Paused, Error, NoData',
    ]);
  });

  it('accepts a negated label regex leaf, as sent for Hide plugin rules', () => {
    const query = queryWith({
      regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true },
    });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual([]);
    expect(getRuleSearchQueryViolations(query, 'recording')).toEqual([]);
  });

  it('reports a negated regex on a field other than labels', () => {
    const query = queryWith({ regex: { field: 'folder', pattern: 'a=b', negate: true } });
    expect(getRuleSearchQueryViolations(query, 'alert')).toEqual(['regex is only accepted on labels, got folder']);
  });
});
