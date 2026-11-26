import { type AppPluginConfig, type AppPluginKind } from '@grafana/data';
import { addResourceBundle } from '@grafana/i18n/internal';
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
    label: name,
    labelPlural: `${name}s`,
    ...overrides,
  };
}

function testApp(kinds: AppPluginKind[]): AppPluginConfig {
  return { ...genericAppPluginConfig, id: 'test-app', kinds };
}

describe('addDeclaredPluginKinds', () => {
  it("adds a declared kind with its labels, icon and the plugin's page of an object", () => {
    addDeclaredPluginKinds([testApp([declaredKind('Widget', { folderScoped: true })])]);

    const kind = findKind(GROUP, 'Widget');
    expect(kind).toMatchObject({ group: GROUP, kind: 'Widget', resource: 'widgets', folderScoped: true, icon: 'cube' });
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Widget',
      'widget',
      'Widgets',
    ]);
    expect(kind?.getRoute?.('a b/c')).toBe('/a/test-app/widgets/a%20b%2Fc');
  });

  it("labels a kind from the plugin's translations when the declaration names their keys", () => {
    addResourceBundle('en-US', 'test-app', { kinds: { gadget: 'gizmo', gadgets: 'gizmos' } });

    addDeclaredPluginKinds([
      testApp([declaredKind('Gadget', { labelKey: 'kinds.gadget', labelPluralKey: 'kinds.gadgets' })]),
    ]);

    const kind = findKind(GROUP, 'Gadget');
    expect([kind?.getLabel(), kind?.getPluralLabel()]).toEqual(['Gizmo', 'Gizmos']);
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

  it.each([
    { desc: "a route outside the plugin's pages", kind: 'Outside', overrides: { route: '/admin/users/{name}' } },
    { desc: 'a route that leaves them', kind: 'Escaping', overrides: { route: '/a/test-app/../../admin/{name}' } },
    { desc: 'a route without the name', kind: 'Nameless', overrides: { route: '/a/test-app/nameless' } },
    { desc: 'an icon Grafana does not have', kind: 'Iconless', overrides: { icon: 'not-an-icon' } },
  ])('leaves out a kind declared with $desc', ({ kind, overrides }) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    addDeclaredPluginKinds([testApp([declaredKind(kind, overrides)])]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/${kind}`));
    expect(findKind(GROUP, kind)).toBeUndefined();
    warn.mockRestore();
  });
});
