import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

describe('buildAlertRuleSearchQuery', () => {
  it('asks for the first 40 rules by title with the fields the row shows', () => {
    expect(buildAlertRuleSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      sort: [{ field: 'title', direction: 'asc' }],
      fields: ['title', 'folder', 'paused', 'state', 'health', 'lastError', 'annotations', 'interval'],
      limit: 40,
    });
  });

  it('passes the continuation token through', () => {
    expect(buildAlertRuleSearchQuery('opaque-token').continue).toBe('opaque-token');
  });
});
