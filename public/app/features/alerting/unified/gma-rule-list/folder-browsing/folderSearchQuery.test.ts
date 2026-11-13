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

  it('keeps the label selector when scoping to folder uids and passes the continue token', () => {
    const query = buildFolderListSearchQuery('alert', 'tok', ['f1', 'f2']);

    expect(query.labelSelector).toEqual({ matchLabels: { 'alerting.grafana.app/has-alert-rules': 'true' } });
    expect(query.where).toEqual({ filter: { field: 'name', operator: 'In', values: ['f1', 'f2'] } });
    expect(query.continue).toBe('tok');
  });
});
