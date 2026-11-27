import { type AppPluginConfig, type AppPluginKind } from '@grafana/data';
import { type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

import { genericAppPluginConfig } from './extensions/test-fixtures/config.apps';
import { addDeclaredPluginKinds } from './pluginKinds';

const GROUP = 'widgets.ext.grafana.app';

// The registry is shared by the tests of this file, so each test declares kinds of its own
function declaredKind(kind: string, overrides: Partial<AppPluginKind> = {}): AppPluginKind {
  const name = kind.toLowerCase();
  return {
    group: GROUP,
    kind,
    resource: `${name}s`,
    folderScoped: false,
    icon: 'cube',
    route: `/a/test-app/${name}s/{name}`,
    ...overrides,
  };
}

function testApp(kinds: AppPluginKind[]): AppPluginConfig {
  return { ...genericAppPluginConfig, id: 'test-app', kinds };
}

describe('addDeclaredPluginKinds', () => {
  it("adds a declared kind with its labels, icon and the plugin's page of an object", () => {
    const declared = declaredKind('Widget', { folderScoped: true, label: 'tiny widget', labelPlural: 'tiny widgets' });
    addDeclaredPluginKinds([testApp([declared])]);

    const kind = findKind(GROUP, 'Widget');
    expect(kind).toMatchObject({ group: GROUP, kind: 'Widget', resource: 'widgets', folderScoped: true, icon: 'cube' });
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Tiny widget',
      'tiny widget',
      'Tiny widgets',
    ]);
    expect(kind?.getRoute?.('a b/c')).toBe('/a/test-app/widgets/a%20b%2Fc');
  });

  it('names a kind declared without labels by its kind and its resource', () => {
    addDeclaredPluginKinds([testApp([declaredKind('Policy', { resource: 'policies' })])]);

    const kind = findKind(GROUP, 'Policy');
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Policy',
      'policy',
      'Policies',
    ]);
  });

  it("keeps the kind the plugin's module added", () => {
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

    addDeclaredPluginKinds([testApp([declaredKind('Sprocket')])]);

    expect(findKind(GROUP, 'Sprocket')).toBe(moduleKind);
  });

  it('gives the link icon to a kind declared with an icon Grafana does not have', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    addDeclaredPluginKinds([testApp([declaredKind('Iconless', { icon: 'not-an-icon' })])]);

    expect(findKind(GROUP, 'Iconless')?.icon).toBe('link');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/Iconless`));
    warn.mockRestore();
  });

  it.each([
    { desc: "a route outside the plugin's pages", kind: 'Outside', overrides: { route: '/admin/users/{name}' } },
    { desc: 'a route that leaves them', kind: 'Escaping', overrides: { route: '/a/test-app/../../admin/{name}' } },
    { desc: 'a route without the name', kind: 'Nameless', overrides: { route: '/a/test-app/nameless' } },
  ])('leaves out a kind declared with $desc', ({ kind, overrides }) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    addDeclaredPluginKinds([testApp([declaredKind(kind, overrides)])]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/${kind}`));
    expect(findKind(GROUP, kind)).toBeUndefined();
    warn.mockRestore();
  });
});
