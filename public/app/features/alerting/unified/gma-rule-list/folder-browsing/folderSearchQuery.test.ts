import { buildFolderListSearchQuery } from './folderSearchQuery';

describe('buildFolderListSearchQuery', () => {
  it('always selects folders labelled as containing rules', () => {
    expect(buildFolderListSearchQuery()).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      labelSelector: { matchLabels: { 'alerting.grafana.app/has-rules': 'true' } },
      fields: ['title'],
      sort: [{ field: 'title', direction: 'asc' }],
      limit: 40,
    });
  });

  it('keeps the label selector when scoping to folder names and passes the continue token', () => {
    const query = buildFolderListSearchQuery('tok', ['Alerts', 'Team 01']);

    expect(query.labelSelector).toEqual({ matchLabels: { 'alerting.grafana.app/has-rules': 'true' } });
    expect(query.where).toEqual({ filter: { field: 'title', operator: 'In', values: ['Alerts', 'Team 01'] } });
    expect(query.continue).toBe('tok');
  });
});
