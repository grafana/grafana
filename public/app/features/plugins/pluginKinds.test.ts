import { type AppPluginConfig, type AppPluginKind } from '@grafana/data';
import { addResourceBundle, changeLanguage, getI18nInstance } from '@grafana/i18n/internal';
import { type KindInfo } from '@grafana/runtime/unstable';
import { addKinds, findKind } from 'app/core/kinds/coreKinds';

import { genericAppPluginConfig } from './extensions/test-fixtures/config.apps';
import { SystemJS } from './loader/systemjs';
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
  it("adds a declared kind with its labels, icon and the plugin's page of an object", async () => {
    await addDeclaredPluginKinds([testApp([declaredKind('Widget', { folderScoped: true })])]);

    const kind = findKind(GROUP, 'Widget');
    expect(kind).toMatchObject({ group: GROUP, kind: 'Widget', resource: 'widgets', folderScoped: true, icon: 'cube' });
    expect([kind?.getLabel(), kind?.getLabel({ upperFirst: false }), kind?.getPluralLabel()]).toEqual([
      'Widget',
      'widget',
      'Widgets',
    ]);
    expect(kind?.getRoute?.('a b/c')).toBe('/a/test-app/widgets/a%20b%2Fc');
  });

  describe('in a language other than English', () => {
    beforeEach(async () => {
      // Grafana's own translations are what make the language the resolved one
      addResourceBundle('pt-BR', 'grafana', { greeting: 'olá' });
      await changeLanguage('pt-BR');
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      getI18nInstance().removeResourceBundle('pt-BR', 'grafana');
      getI18nInstance().removeResourceBundle('pt-BR', 'test-app');
      await changeLanguage('en-US');
    });

    it("adds a kind with its labels translated, once the plugin's translations have loaded", async () => {
      jest
        .spyOn(SystemJS, 'import')
        .mockResolvedValue({ default: { kinds: { doohickey: 'treco', doohickeys: 'trecos' } } });
      const app = {
        ...testApp([declaredKind('Doohickey', { labelKey: 'kinds.doohickey', labelPluralKey: 'kinds.doohickeys' })]),
        translations: { 'pt-BR': 'public/plugins/test-app/locales/pt-BR/test-app.json' },
      };

      const added = addDeclaredPluginKinds([app]);
      expect(findKind(GROUP, 'Doohickey')).toBeUndefined();
      await added;

      const kind = findKind(GROUP, 'Doohickey');
      expect([kind?.getLabel(), kind?.getPluralLabel()]).toEqual(['Treco', 'Trecos']);
    });
  });

  it("keeps the kind the plugin's module added", async () => {
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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind('Iconless', { icon: 'not-an-icon' })])]);

    expect(findKind(GROUP, 'Iconless')?.icon).toBe('link');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/Iconless`));
    warn.mockRestore();
  });

  it.each([
    { desc: 'no plural label', kind: 'Pluralless', overrides: { labelPlural: '' } },
    { desc: "a route outside the plugin's pages", kind: 'Outside', overrides: { route: '/admin/users/{name}' } },
    { desc: 'a route that leaves them', kind: 'Escaping', overrides: { route: '/a/test-app/../../admin/{name}' } },
    { desc: 'a route without the name', kind: 'Nameless', overrides: { route: '/a/test-app/nameless' } },
  ])('leaves out a kind declared with $desc', async ({ kind, overrides }) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addDeclaredPluginKinds([testApp([declaredKind(kind, overrides)])]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${GROUP}/${kind}`));
    expect(findKind(GROUP, kind)).toBeUndefined();
    warn.mockRestore();
  });
});
