import { config, setBackendSrv, type BackendSrv } from '@grafana/runtime';

import { createAppPlatformResolver } from './appPlatformResolver';

const get = jest.fn();
const post = jest.fn();

const kind = createAppPlatformResolver({
  group: 'things.example.app',
  version: 'v1',
  resource: 'things',
  title: 'Things',
  icon: 'file-alt',
  viewUrl: (name) => `/things/${name}`,
});

describe('createAppPlatformResolver', () => {
  const originalNamespace = config.namespace;

  beforeEach(() => {
    jest.clearAllMocks();
    config.namespace = 'stacks-42';
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    setBackendSrv({ get, post } as unknown as BackendSrv);
  });

  afterAll(() => {
    config.namespace = originalNamespace;
  });

  it('carries the identity and presentation of the kind', () => {
    expect(kind).toMatchObject({ group: 'things.example.app', resource: 'things', title: 'Things', icon: 'file-alt' });
  });

  describe('resolve', () => {
    it('reads the object from its namespaced path and returns its title and url', async () => {
      get.mockResolvedValue({ metadata: { name: 'abc' }, spec: { title: 'Weekly review' } });

      await expect(kind.resolve('abc')).resolves.toEqual({ url: '/things/abc', title: 'Weekly review' });
      expect(get).toHaveBeenCalledWith(
        '/apis/things.example.app/v1/namespaces/stacks-42/things/abc',
        undefined,
        undefined,
        { showErrorAlert: false }
      );
    });

    it('falls back to the name when the object has no title', async () => {
      get.mockResolvedValue({ metadata: { name: 'abc' }, spec: {} });

      await expect(kind.resolve('abc')).resolves.toEqual({ url: '/things/abc', title: 'abc' });
    });

    it.each([403, 404])('returns undefined when the server answers %s', async (status) => {
      get.mockRejectedValue({ status, data: {} });

      await expect(kind.resolve('abc')).resolves.toBeUndefined();
    });

    it('lets other failures through so the caller can tell them from a missing object', async () => {
      get.mockRejectedValue({ status: 500, data: {} });

      await expect(kind.resolve('abc')).rejects.toEqual({ status: 500, data: {} });
    });

    it('encodes the name so it cannot change the request path', async () => {
      get.mockResolvedValue({ metadata: { name: 'a/b' }, spec: {} });

      await kind.resolve('a/../b');

      expect(get.mock.calls[0][0]).toBe('/apis/things.example.app/v1/namespaces/stacks-42/things/a%2F..%2Fb');
    });
  });

  describe('search', () => {
    it('posts a title text query to the per-kind search route and maps the hits', async () => {
      post.mockResolvedValue({
        items: [
          { resource: { name: 'a' }, fields: { title: 'Alpha' } },
          { resource: { name: 'b' }, fields: {} },
        ],
      });

      await expect(kind.search('alp', 10)).resolves.toEqual([
        { name: 'a', title: 'Alpha' },
        { name: 'b', title: 'b' },
      ]);
      expect(post).toHaveBeenCalledWith(
        '/apis/things.example.app/v1/namespaces/stacks-42/things/search',
        {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'SearchQuery',
          where: { text: { value: 'alp', fields: ['title'] } },
          fields: ['title'],
          limit: 10,
        },
        { showErrorAlert: false }
      );
    });

    it('omits the text predicate when the query is empty so the picker can list everything', async () => {
      post.mockResolvedValue({ items: [] });

      await kind.search('', 5);

      expect(post.mock.calls[0][1]).not.toHaveProperty('where');
    });

    it('returns no results when the response has no items', async () => {
      post.mockResolvedValue({});

      await expect(kind.search('x', 5)).resolves.toEqual([]);
    });
  });
});
