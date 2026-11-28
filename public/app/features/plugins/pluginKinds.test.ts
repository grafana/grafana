import { http, HttpResponse } from 'msw';

import { type AppPluginConfig, type AppPluginKind } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { type KindInfo } from '@grafana/runtime/unstable';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';
import { backendSrv } from 'app/core/services/backend_srv';

import { genericAppPluginConfig } from './extensions/test-fixtures/config.apps';
import { addDeclaredPluginKinds } from './pluginKinds';

const GROUP = 'widgets.ext.grafana.app';

setBackendSrv(backendSrv);
setupMockServer();

// The registry is shared by the tests of this file, so each test declares kinds of its own
function declaredKind(kind: string, overrides: Partial<AppPluginKind> = {}): AppPluginKind {
  return { group: GROUP, kind, icon: 'cube', route: `/a/test-app/${kind.toLowerCase()}s/{name}`, ...overrides };
}

function testApp(kinds: AppPluginKind[]): AppPluginConfig {
  return { ...genericAppPluginConfig, id: 'test-app', kinds };
}

interface ServedKind {
  kind: string;
  resource: string;
  scope?: 'Namespaced' | 'Cluster';
  group?: string;
}

/** Has the server answer API discovery with these kinds, served by the test group unless they name another. */
function serve(...kinds: ServedKind[]) {
  const groups = [...new Set(kinds.map(({ group = GROUP }) => group))];
  server.use(
    http.get('/apis', () =>
      HttpResponse.json({
        kind: 'APIGroupDiscoveryList',
        apiVersion: 'apidiscovery.k8s.io/v2',
        metadata: {},
        items: groups.map((name) => ({
          metadata: { name },
          versions: [
            {
              version: 'v1alpha1',
              freshness: 'Current',
              resources: kinds
                .filter(({ group = GROUP }) => group === name)
                .map(({ kind, resource, scope = 'Namespaced' }) => ({
                  resource,
                  // The server leaves these two empty: the group version a kind is listed under says them
                  responseKind: { group: '', version: '', kind },
                  scope,
                  singularResource: kind.toLowerCase(),
                  verbs: ['get', 'list'],
                })),
            },
          ],
        })),
      })
    )
  );
}

describe('addDeclaredPluginKinds', () => {
  it('adds a kind the server serves, with its looks from plugin.json and its plural from API discovery', async () => {
    serve({ kind: 'Widget', resource: 'widgets' });
    const declared = declaredKind('Widget', { label: 'tiny widget', labelPlural: 'tiny widgets' });

    await addDeclaredPluginKinds([testApp([declared])]);

    const kind = findKind(GROUP, 'Widget');
    expect(kind).toMatchObject({ group: GROUP, kind: 'Widget', resource: 'widgets', icon: 'cube' });
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Tiny widget',
      'tiny widget',
      'Tiny widgets',
    ]);
    expect(kind?.getRoute?.('a b/c')).toBe('/a/test-app/widgets/a%20b%2Fc');
  });

  it('names a kind declared without labels by its kind and the plural the server serves it under', async () => {
    serve({ kind: 'Policy', resource: 'policies' });

    await addDeclaredPluginKinds([testApp([declaredKind('Policy')])]);

    const kind = findKind(GROUP, 'Policy');
    expect(kind?.resource).toBe('policies');
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Policy',
      'policy',
      'Policies',
    ]);
  });

  it('gives a kind the page that creates its objects, as plugin.json declares it', async () => {
    serve({ kind: 'Gadget', resource: 'gadgets' });

    await addDeclaredPluginKinds([testApp([declaredKind('Gadget', { createRoute: '/a/test-app/gadgets/new' })])]);

    expect(findKind(GROUP, 'Gadget')?.createRoute).toBe('/a/test-app/gadgets/new');
  });

  it("keeps a kind whose create route is outside the plugin's pages, without the create route", async () => {
    serve({ kind: 'Gizmo', resource: 'gizmos' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind('Gizmo', { createRoute: '/admin/users/new' })])]);

    const kind = findKind(GROUP, 'Gizmo');
    expect(kind?.resource).toBe('gizmos');
    expect(kind?.createRoute).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/Gizmo`));
    warn.mockRestore();
  });

  it('leaves out a kind that its declared group does not serve', async () => {
    const otherGroup = 'other.ext.grafana.app';
    serve({ kind: 'Served', resource: 'serveds' }, { kind: 'Namesake', resource: 'namesakes', group: otherGroup });

    await addDeclaredPluginKinds([
      testApp([declaredKind('Served'), declaredKind('Unserved'), declaredKind('Namesake')]),
    ]);

    expect(findKind(GROUP, 'Served')?.resource).toBe('serveds');
    expect(findKind(GROUP, 'Unserved')).toBeUndefined();
    expect(findKind(GROUP, 'Namesake')).toBeUndefined();
    expect(findKind(otherGroup, 'Namesake')).toBeUndefined();
  });

  it.each<{ desc: string; kind: string; scope: 'Namespaced' | 'Cluster'; declared?: boolean; expected: boolean }>([
    { desc: 'puts a namespaced kind in folders', kind: 'Foldered', scope: 'Namespaced', expected: true },
    {
      desc: 'keeps a namespaced kind that plugin.json opts out of folders out of them',
      kind: 'OptedOut',
      scope: 'Namespaced',
      declared: false,
      expected: false,
    },
    {
      desc: 'keeps a cluster-scoped kind out of folders, whatever plugin.json says',
      kind: 'Clustered',
      scope: 'Cluster',
      declared: true,
      expected: false,
    },
  ])('$desc', async ({ kind, scope, declared, expected }) => {
    serve({ kind, resource: `${kind.toLowerCase()}s`, scope });

    await addDeclaredPluginKinds([testApp([declaredKind(kind, { folderScoped: declared })])]);

    expect(findKind(GROUP, kind)?.folderScoped).toBe(expected);
  });

  it("keeps the kind the plugin's module added", async () => {
    serve({ kind: 'Sprocket', resource: 'sprockets' });
    const moduleKind: KindInfo = {
      group: GROUP,
      kind: 'Sprocket',
      resource: 'sprockets',
      folderScoped: false,
      getLabel: () => 'Sprocket',
      getPluralLabel: () => 'Sprockets',
      icon: 'cog',
      getRoute: (name, title) => `/a/test-app/sprockets/${title}-${name}`,
    };
    addKinds([moduleKind]);

    await addDeclaredPluginKinds([testApp([declaredKind('Sprocket')])]);

    expect(findKind(GROUP, 'Sprocket')).toBe(moduleKind);
  });

  it('gives the link icon to a kind declared with an icon Grafana does not have', async () => {
    serve({ kind: 'Iconless', resource: 'iconlesses' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind('Iconless', { icon: 'not-an-icon' })])]);

    expect(findKind(GROUP, 'Iconless')?.icon).toBe('link');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/Iconless`));
    warn.mockRestore();
  });

  it.each([
    { desc: "a route outside the plugin's pages", kind: 'Outside', overrides: { route: '/admin/users/{name}' } },
    { desc: 'a route that leaves them', kind: 'Escaping', overrides: { route: '/a/test-app/../../admin/{name}' } },
    { desc: 'a route without the name', kind: 'Nameless', overrides: { route: '/a/test-app/nameless' } },
  ])('leaves out a kind the server serves but plugin.json declares with $desc', async ({ kind, overrides }) => {
    serve({ kind, resource: `${kind.toLowerCase()}s` });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind(kind, overrides)])]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/${kind}`));
    expect(findKind(GROUP, kind)).toBeUndefined();
    warn.mockRestore();
  });

  it('warns and leaves the declared kinds out when API discovery fails', async () => {
    server.use(http.get('/apis', () => new HttpResponse(null, { status: 500 })));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind('Orphan')])]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('API discovery failed'), expect.anything());
    expect(findKind(GROUP, 'Orphan')).toBeUndefined();
    warn.mockRestore();
  });

  it('asks the server what it serves only when an app declares a kind', async () => {
    let requests = 0;
    server.use(
      http.get('/apis', () => {
        requests++;
        return HttpResponse.json({ items: [] });
      })
    );

    await addDeclaredPluginKinds([testApp([])]);
    expect(requests).toBe(0);

    await addDeclaredPluginKinds([testApp([declaredKind('Asked')])]);
    expect(requests).toBe(1);
  });
});
