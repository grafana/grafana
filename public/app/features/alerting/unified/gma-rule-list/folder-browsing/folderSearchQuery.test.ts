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

  it('passes the continue token through', () => {
    expect(buildFolderListSearchQuery('alert', 'tok', { folderUids: [] }).continue).toBe('tok');
  });

  it.each([
    {
      name: 'a folder name as title text',
      scope: { folder: 'Team 01', folderUids: [] },
      where: { text: { value: 'Team 01' } },
    },
    {
      name: 'folder UIDs',
      scope: { folderUids: ['f1', 'f2'] },
      where: { filter: { field: 'name', operator: 'In', values: ['f1', 'f2'] } },
    },
    {
      name: 'both, so a folder must match each',
      scope: { folder: 'team', folderUids: ['f1'] },
      where: { and: [{ text: { value: 'team' } }, { filter: { field: 'name', operator: 'In', values: ['f1'] } }] },
    },
  ])('scopes the listing to $name', ({ scope, where }) => {
    expect(buildFolderListSearchQuery('alert', undefined, scope).where).toEqual(where);
  });
});
