import { buildWhere, toRequestBody } from './globalSearchApi';

describe('buildWhere', () => {
  it('returns undefined when no filter is set', () => {
    expect(buildWhere({})).toBeUndefined();
    expect(buildWhere({ text: '   ', types: [], folders: [], tags: [] })).toBeUndefined();
  });

  it('searches title and description for text', () => {
    expect(buildWhere({ text: ' latency ' })).toEqual({
      and: [{ text: { value: 'latency', fields: ['title', 'description'] } }],
    });
  });

  it('combines every filter into a single and', () => {
    expect(
      buildWhere({
        text: 'checkout',
        types: ['dashboard.grafana.app/dashboards', 'assistant.ext.grafana.app/pages'],
        folders: ['fklt8j'],
        tags: ['checkout', 'incident'],
        names: ['abc'],
      })
    ).toEqual({
      and: [
        { text: { value: 'checkout', fields: ['title', 'description'] } },
        {
          filter: {
            field: 'groupResource',
            operator: 'In',
            values: ['dashboard.grafana.app/dashboards', 'assistant.ext.grafana.app/pages'],
          },
        },
        { filter: { field: 'folder', operator: 'In', values: ['fklt8j'] } },
        { filter: { field: 'tags', operator: 'All', values: ['checkout', 'incident'] } },
        { filter: { field: 'name', operator: 'In', values: ['abc'] } },
      ],
    });
  });

  it('uses the folder tree only when subfolders are included', () => {
    expect(buildWhere({ folders: ['a'], includeSubfolders: true })).toEqual({
      and: [{ filter: { field: 'folderTree', operator: 'In', values: ['a'] } }],
    });
    expect(buildWhere({ folders: ['a'], includeSubfolders: false })).toEqual({
      and: [{ filter: { field: 'folder', operator: 'In', values: ['a'] } }],
    });
  });
});

describe('buildWhere for the filter menu', () => {
  it('matches root content but not root folders for "No folder"', () => {
    expect(buildWhere({ noFolder: true, folders: ['ignored'] })).toEqual({
      and: [
        { filter: { field: 'groupResource', operator: 'NotIn', values: ['folder.grafana.app/folders'] } },
        { filter: { field: 'folder', operator: 'In', values: [''] } },
      ],
    });
  });

  it('excludes types in one leaf, even when "No folder" also excludes folders', () => {
    expect(
      buildWhere({ excludeTypes: ['folder.grafana.app/folders', 'dashboard.grafana.app/variables'], noFolder: true })
    ).toEqual({
      and: [
        {
          filter: {
            field: 'groupResource',
            operator: 'NotIn',
            values: ['folder.grafana.app/folders', 'dashboard.grafana.app/variables'],
          },
        },
        { filter: { field: 'folder', operator: 'In', values: [''] } },
      ],
    });
  });

  it('filters owners and recent updates', () => {
    expect(buildWhere({ owners: ['user:abc'], updatedSince: 1000 })).toEqual({
      and: [
        { filter: { field: 'createdBy', operator: 'In', values: ['user:abc'] } },
        { range: { field: 'updated', gte: 1000 } },
      ],
    });
  });

  it('keeps only things synced from a Git repository for "Provisioned only"', () => {
    expect(buildWhere({ provisioned: true })).toEqual({
      and: [{ filter: { field: 'manager.kind', operator: 'In', values: ['repo'] } }],
    });
    expect(buildWhere({ provisioned: false })).toBeUndefined();
  });
});

describe('toRequestBody', () => {
  it('adds the SearchQuery type metadata', () => {
    expect(toRequestBody({ limit: 1 })).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      limit: 1,
    });
  });
});
