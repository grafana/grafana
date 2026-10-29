import { buildFolderListSearchQuery } from './folderSearchQuery';

describe('buildFolderListSearchQuery', () => {
  it('selects folders labelled as holding alert rules for the alert kind', () => {
    expect(buildFolderListSearchQuery('alert')).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      labelSelector: { matchLabels: { 'alerting.grafana.app/has-alert-rules': 'true' } },
      fields: ['title'],
      sort: [{ field: 'title', direction: 'asc' }],
      limit: 40,
    });
  });

  it('selects folders labelled as holding recording rules for the recording kind', () => {
    expect(buildFolderListSearchQuery('recording').labelSelector).toEqual({
      matchLabels: { 'alerting.grafana.app/has-recording-rules': 'true' },
    });
  });

  it('keeps the label selector when scoping to folder names and passes the continue token', () => {
    const query = buildFolderListSearchQuery('alert', 'tok', ['Alerts', 'Team 01']);

    expect(query.labelSelector).toEqual({ matchLabels: { 'alerting.grafana.app/has-alert-rules': 'true' } });
    expect(query.where).toEqual({ filter: { field: 'title', operator: 'In', values: ['Alerts', 'Team 01'] } });
    expect(query.continue).toBe('tok');
  });
});
