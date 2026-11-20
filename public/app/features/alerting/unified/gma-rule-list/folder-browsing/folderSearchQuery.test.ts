import { buildFolderListSearchQuery } from './folderSearchQuery';

describe('buildFolderListSearchQuery', () => {
  it('selects folders labelled as holding alert rules for the alert kind', () => {
    expect(buildFolderListSearchQuery('alert', undefined, { folderUids: [] })).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      labelSelector: { matchLabels: { 'alerting.grafana.app/has-alert-rules': 'true' } },
      fields: ['title'],
      sort: [{ field: 'title', direction: 'asc' }],
      limit: 40,
    });
  });

  it('selects folders labelled as holding recording rules for the recording kind', () => {
    expect(buildFolderListSearchQuery('recording', undefined, { folderUids: [] }).labelSelector).toEqual({
      matchLabels: { 'alerting.grafana.app/has-recording-rules': 'true' },
    });
  });

  it('keeps the label selector when scoping to a folder name and passes the continue token', () => {
    const query = buildFolderListSearchQuery('alert', 'tok', { folder: 'Team 01', folderUids: [] });

    expect(query.labelSelector).toEqual({ matchLabels: { 'alerting.grafana.app/has-alert-rules': 'true' } });
    expect(query.where).toEqual({ text: { value: 'Team 01' } });
    expect(query.continue).toBe('tok');
  });

  it.each([
    [{ folderUids: ['f1', 'f2'] }, { filter: { field: 'name', operator: 'In', values: ['f1', 'f2'] } }],
    [
      { folder: 'team', folderUids: ['f1'] },
      { and: [{ text: { value: 'team' } }, { filter: { field: 'name', operator: 'In', values: ['f1'] } }] },
    ],
  ])('scopes the listing for %j', (scope, where) => {
    expect(buildFolderListSearchQuery('alert', undefined, scope).where).toEqual(where);
  });
});
