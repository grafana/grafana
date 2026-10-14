import { getRuleSearchQueryViolations } from './ruleSearchQueryContract';
import { type SearchQuery } from './searchQueryLeaves';

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
});
