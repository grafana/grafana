import {
  fromK8sAPIGroupDiscoveryList,
  fromK8sAPIResourceList,
  hasStaleVersion,
  isK8sAPIGroupDiscoveryList,
  isK8sAPIResourceList,
} from './resources';

const folderResourceList = {
  kind: 'APIResourceList',
  apiVersion: 'v1',
  groupVersion: 'folder.grafana.app/v1beta1',
  resources: [
    {
      name: 'folders',
      singularName: 'folder',
      namespaced: true,
      kind: 'Folder',
      verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
    },
    { name: 'folders/access', singularName: '', namespaced: true, kind: 'FolderAccessInfo', verbs: ['get'] },
    { name: 'folders/status', singularName: '', namespaced: true, kind: 'Folder', verbs: ['get', 'patch', 'update'] },
  ],
};

const folderGroupDiscovery = {
  metadata: { name: 'folder.grafana.app' },
  versions: [
    {
      version: 'v1beta1',
      resources: [
        {
          resource: 'folders',
          responseKind: { group: '', version: '', kind: 'Folder' },
          scope: 'Namespaced',
          singularResource: 'folder',
          verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
          subresources: [
            {
              subresource: 'access',
              responseKind: { group: '', version: '', kind: 'FolderAccessInfo' },
              verbs: ['get'],
            },
            {
              subresource: 'status',
              responseKind: { group: '', version: '', kind: 'Folder' },
              verbs: ['get', 'patch', 'update'],
            },
          ],
        },
      ],
      freshness: 'Current',
    },
  ],
};

const folders = {
  group: 'folder.grafana.app',
  version: 'v1beta1',
  resource: 'folders',
  kind: 'Folder',
  namespaced: true,
  verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
  subresources: ['access', 'status'],
};

describe('fromK8sAPIResourceList', () => {
  it('lists each resource with its subresources', () => {
    const { resources } = fromK8sAPIResourceList('folder.grafana.app', 'v1beta1', folderResourceList);

    expect(resources).toEqual([folders]);
  });

  it('keeps the verbs of each resource and subresource', () => {
    const { verbs } = fromK8sAPIResourceList('folder.grafana.app', 'v1beta1', folderResourceList);

    expect(Object.fromEntries(verbs)).toEqual({
      folders: ['create', 'delete', 'get', 'list', 'patch', 'update'],
      'folders/access': ['get'],
      'folders/status': ['get', 'patch', 'update'],
    });
  });

  it('adds a resource for a subresource listed without it, after the listed ones, as Kubernetes does', () => {
    const { resources, verbs } = fromK8sAPIResourceList('example.grafana.app', 'v1', {
      resources: [
        { name: 'widgets/scale', namespaced: true, kind: 'Scale', verbs: ['get'] },
        { name: 'gadgets', namespaced: true, kind: 'Gadget', verbs: ['list'] },
      ],
    });

    expect(
      resources.map(({ resource, kind, verbs, subresources }) => ({ resource, kind, verbs, subresources }))
    ).toEqual([
      { resource: 'gadgets', kind: 'Gadget', verbs: ['list'], subresources: [] },
      { resource: 'widgets', kind: '', verbs: [], subresources: ['scale'] },
    ]);
    expect(verbs.get('widgets/scale')).toEqual(['get']);
  });

  it('reads a missing kind, scope or verbs as empty', () => {
    const { resources } = fromK8sAPIResourceList('example.grafana.app', 'v1', {
      resources: [{ name: 'gadgets', verbs: null }],
    });

    expect(resources).toEqual([
      {
        group: 'example.grafana.app',
        version: 'v1',
        resource: 'gadgets',
        kind: '',
        namespaced: false,
        verbs: [],
        subresources: [],
      },
    ]);
  });

  it('reads an empty list written as null', () => {
    const { resources, verbs } = fromK8sAPIResourceList('search.grafana.app', 'v0alpha1', { resources: null });

    expect(resources).toEqual([]);
    expect(verbs.size).toBe(0);
  });
});

describe('fromK8sAPIGroupDiscoveryList', () => {
  it('lists every resource by group, then by version, in server order', () => {
    const list = {
      items: [
        {
          metadata: { name: 'dashboard.grafana.app' },
          versions: [
            { version: 'v2beta1', resources: [{ resource: 'dashboards', scope: 'Namespaced', verbs: ['get'] }] },
            { version: 'v1beta1', resources: [{ resource: 'dashboards', scope: 'Namespaced', verbs: ['list'] }] },
          ],
        },
        folderGroupDiscovery,
      ],
    };

    expect(
      fromK8sAPIGroupDiscoveryList(list).map(({ group, version, resource }) => `${group}/${version}/${resource}`)
    ).toEqual([
      'dashboard.grafana.app/v2beta1/dashboards',
      'dashboard.grafana.app/v1beta1/dashboards',
      'folder.grafana.app/v1beta1/folders',
    ]);
  });

  it('reports a group version the same way as its resource list', () => {
    expect(fromK8sAPIGroupDiscoveryList({ items: [folderGroupDiscovery] })).toEqual(
      fromK8sAPIResourceList('folder.grafana.app', 'v1beta1', folderResourceList).resources
    );
  });

  it('skips versions without resources, which serve routes only', () => {
    const list = { items: [{ metadata: { name: 'quotas.grafana.app' }, versions: [{ version: 'v0alpha1' }] }] };

    expect(fromK8sAPIGroupDiscoveryList(list)).toEqual([]);
  });

  it('reads missing and null fields as empty', () => {
    const list = {
      items: [
        {
          metadata: { name: 'example.grafana.app' },
          versions: [
            { version: 'v1', resources: [{ resource: 'gadgets', responseKind: null, scope: 'Cluster', verbs: null }] },
          ],
        },
      ],
    };

    expect(fromK8sAPIGroupDiscoveryList(list)).toEqual([
      {
        group: 'example.grafana.app',
        version: 'v1',
        resource: 'gadgets',
        kind: '',
        namespaced: false,
        verbs: [],
        subresources: [],
      },
    ]);
  });

  it('reads an empty list written as null', () => {
    expect(fromK8sAPIGroupDiscoveryList({ items: null })).toEqual([]);
    expect(hasStaleVersion({ items: null })).toBe(false);
  });
});

describe('hasStaleVersion', () => {
  it('is true when any version is stale', () => {
    const stale = { metadata: { name: 'example.ext.grafana.app' }, versions: [{ version: 'v1', freshness: 'Stale' }] };

    expect(hasStaleVersion({ items: [folderGroupDiscovery, stale] })).toBe(true);
  });

  it('is false when every version is current', () => {
    const routeOnly = { metadata: { name: 'quotas.grafana.app' } };

    expect(hasStaleVersion({ items: [folderGroupDiscovery, routeOnly] })).toBe(false);
  });
});

describe('isK8sAPIResourceList', () => {
  it('accepts an empty list, which Go writes as null', () => {
    const empty = {
      kind: 'APIResourceList',
      apiVersion: 'v1',
      groupVersion: 'search.grafana.app/v0alpha1',
      resources: null,
    };

    expect(isK8sAPIResourceList(empty)).toBe(true);
  });

  it('accepts a resource list, also with null verbs', () => {
    expect(isK8sAPIResourceList(folderResourceList)).toBe(true);
    expect(isK8sAPIResourceList({ resources: [{ name: 'gadgets', verbs: null }] })).toBe(true);
  });

  it.each([
    ['an HTML page', '<!doctype html>'],
    ['a group list', { kind: 'APIGroupList', groups: [] }],
    ['a resource without a name', { resources: [{ kind: 'Folder', verbs: [] }] }],
    ['verbs that are not strings', { resources: [{ name: 'folders', verbs: [1] }] }],
    ['a kind that is not a string', { resources: [{ name: 'folders', kind: 1 }] }],
  ])('rejects %s', (_, value) => {
    expect(isK8sAPIResourceList(value)).toBe(false);
  });
});

describe('isK8sAPIGroupDiscoveryList', () => {
  it('accepts an empty list, which Go writes as null', () => {
    expect(isK8sAPIGroupDiscoveryList({ kind: 'APIGroupDiscoveryList', items: null })).toBe(true);
  });

  it('accepts aggregated discovery, also when a version has no resources', () => {
    const routeOnly = {
      metadata: { name: 'quotas.grafana.app' },
      versions: [{ version: 'v0alpha1', freshness: 'Current' }],
    };

    expect(
      isK8sAPIGroupDiscoveryList({ kind: 'APIGroupDiscoveryList', items: [folderGroupDiscovery, routeOnly] })
    ).toBe(true);
  });

  it.each([
    ['a group list, as a server without aggregated discovery answers', { kind: 'APIGroupList', groups: [] }],
    ['a group without a name', { items: [{ metadata: {}, versions: [] }] }],
    [
      'a resource without a name',
      { items: [{ metadata: { name: 'a.grafana.app' }, versions: [{ version: 'v1', resources: [{}] }] }] },
    ],
    [
      'a subresource without a name',
      {
        items: [
          {
            metadata: { name: 'a.grafana.app' },
            versions: [{ version: 'v1', resources: [{ resource: 'gadgets', subresources: [{ verbs: [] }] }] }],
          },
        ],
      },
    ],
    [
      'verbs that are not strings',
      {
        items: [
          {
            metadata: { name: 'a.grafana.app' },
            versions: [{ version: 'v1', resources: [{ resource: 'gadgets', verbs: 'get' }] }],
          },
        ],
      },
    ],
  ])('rejects %s', (_, value) => {
    expect(isK8sAPIGroupDiscoveryList(value)).toBe(false);
  });
});
