import { PanelMenuItem, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';

import { appendExtensionsToPanelMenu, AppendToPanelMenuOpts } from './appendExtensionsToPanelMenu';

const ROOT_CATEGORY = '${root}';

function createLink(overrides: Partial<PluginExtensionLink> = {}): PluginExtensionLink {
  return {
    id: '1',
    pluginId: 'test',
    type: PluginExtensionTypes.link,
    title: 'Link',
    description: '',
    path: '/path',
    ...overrides,
  };
}

function createOptions(overrides: Partial<AppendToPanelMenuOpts> = {}): AppendToPanelMenuOpts {
  return {
    rootMenu: [],
    extensions: [],
    reservedNames: new Set<string>(),
    extensionsSubmenuName: 'Extensions',
    ...overrides,
  };
}

function findMenuItemByText(menu: PanelMenuItem[], text: string): PanelMenuItem | undefined {
  return menu.find((m) => m.text === text);
}

function findExtensionsSubmenu(rootMenu: PanelMenuItem[]): PanelMenuItem | undefined {
  return findMenuItemByText(rootMenu, 'Extensions') ?? findMenuItemByText(rootMenu, 'Plugin actions');
}

describe('appendExtensionsToPanelMenu', () => {
  it('does nothing when extensions is empty', () => {
    const rootMenu: PanelMenuItem[] = [];
    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions: [] }));
    expect(rootMenu).toHaveLength(0);
  });

  it('appends extension both with and without group to Extensions submenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'Declare incident', path: '/a/declare' }),
      createLink({ title: 'Declare incident 2', path: '/a/declare', group: { name: 'Incidents' } }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({
      text: 'Extensions',
      type: 'submenu',
      iconClassName: 'plug',
    });

    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub.subMenu).toHaveLength(3);
    expect(extSub.subMenu![0]).toMatchObject({
      text: 'Incidents',
      type: 'submenu',
    });
    expect(extSub.subMenu![1]).toMatchObject({
      type: 'divider',
    });
    expect(extSub.subMenu![2]).toMatchObject({
      text: 'Declare incident',
      href: '/a/declare',
    });
  });

  it('pushes ROOT_CATEGORY group items directly onto root menu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'Root action', path: '/root/1', group: { name: ROOT_CATEGORY } }),
      createLink({ title: 'Root action 2', path: '/root/2', group: { name: ROOT_CATEGORY } }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(2);
    expect(rootMenu[0]).toMatchObject({ text: 'Root action', href: '/root/1' });
    expect(rootMenu[1]).toMatchObject({ text: 'Root action 2', href: '/root/2' });
  });

  it('does not push root items whose text is in reservedNames', () => {
    const rootMenu: PanelMenuItem[] = [];
    const reservedNames = new Set(['View', 'Remove']);
    const extensions = [
      createLink({ title: 'View', path: '/view', group: { name: ROOT_CATEGORY } }),
      createLink({ title: 'Root action', path: '/root/1', group: { name: ROOT_CATEGORY } }),
      createLink({ title: 'Remove', path: '/remove', group: { name: ROOT_CATEGORY } }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions, reservedNames }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({ text: 'Root action', href: '/root/1' });
  });

  it('creates root-level submenu for SUBMENU_CATEGORY_PREFIX group', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Drilldown link',
        path: '/drill/1',
        group: { name: `${ROOT_CATEGORY}/Metrics drilldown`, icon: 'code-branch' },
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({
      text: 'Metrics drilldown',
      type: 'submenu',
      iconClassName: 'code-branch',
    });
    expect(rootMenu[0].subMenu).toHaveLength(1);
    expect(rootMenu[0].subMenu![0]).toMatchObject({ text: 'Drilldown link', href: '/drill/1' });
  });

  it('uses metrics-drilldown category when extension has no group', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Metrics action',
        path: '/metrics/1',
        category: 'metrics-drilldown',
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({
      text: 'Metrics drilldown',
      type: 'submenu',
      iconClassName: 'code-branch',
    });
    expect(rootMenu[0].subMenu).toHaveLength(1);
    expect(rootMenu[0].subMenu![0]).toMatchObject({ text: 'Metrics action', href: '/metrics/1' });
  });

  it('puts extension with custom category (no group) under Extensions submenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'No group', path: '/no-group' }),
      createLink({
        title: 'Custom action',
        path: '/custom/1',
        category: 'Custom category',
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub.subMenu).toHaveLength(3); // Custom category submenu, divider, no-group item
    expect(extSub.subMenu![0]).toMatchObject({
      text: 'Custom category',
      type: 'submenu',
    });
    expect(extSub.subMenu![0].subMenu).toHaveLength(1);
    expect(extSub.subMenu![0].subMenu![0]).toMatchObject({ text: 'Custom action', href: '/custom/1' });
    expect(extSub.subMenu![1]).toMatchObject({ type: 'divider' });
    expect(extSub.subMenu![2]).toMatchObject({ text: 'No group', href: '/no-group' });
  });

  it('falls back to Extensions submenu when SUBMENU name is reserved and truncated empty', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Fallback link',
        path: '/fallback/1',
        group: { name: `${ROOT_CATEGORY}/` },
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions, reservedNames: new Set(['']) }));

    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub).toBeDefined();
    expect(extSub.subMenu).toHaveLength(1);
    expect(extSub.subMenu![0]).toMatchObject({ text: 'Fallback link', href: '/fallback/1' });
  });

  it('falls back to Extensions submenu when root submenu name is reserved (e.g. More...)', () => {
    const rootMenu: PanelMenuItem[] = [];
    const reservedNames = new Set<string>(['More...']);
    const extensions = [
      createLink({
        title: 'Plugin action',
        path: '/plugin/action',
        group: { name: `${ROOT_CATEGORY}/More...` },
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions, reservedNames }));

    // Should not create a root-level "More..." submenu (would clash with built-in More)
    expect(rootMenu.find((m) => m.text === 'More...')).toBeUndefined();
    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub).toBeDefined();
    expect(extSub.subMenu).toHaveLength(1);
    expect(extSub.subMenu![0]).toMatchObject({ text: 'Plugin action', href: '/plugin/action' });
  });

  it('maps extension openInNewTab to target _blank and preserves icon and onClick', () => {
    const onClick = jest.fn();
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'New tab link',
        path: '/newtab',
        openInNewTab: true,
        icon: 'external-link-alt',
        onClick,
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub.subMenu![0]).toMatchObject({
      text: 'New tab link',
      href: '/newtab',
      target: '_blank',
      iconClassName: 'external-link-alt',
    });
    expect(extSub.subMenu![0].onClick).toBe(onClick);
  });

  it('appends Extensions submenu last when root has ROOT and root-level submenus', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'Root item', path: '/r', group: { name: ROOT_CATEGORY } }),
      createLink({
        title: 'Drill item',
        path: '/d',
        group: { name: `${ROOT_CATEGORY}/Drilldown` },
      }),
      createLink({ title: 'Under Extensions', path: '/e' }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(3);
    expect(rootMenu[0]).toMatchObject({ text: 'Root item' });
    expect(rootMenu[1]).toMatchObject({ text: 'Drilldown', type: 'submenu' });
    expect(rootMenu[2]).toMatchObject({ text: 'Extensions', type: 'submenu' });
  });

  it('does not append Extensions submenu when no extensions use it', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'Only root', path: '/r', group: { name: ROOT_CATEGORY } }),
      createLink({
        title: 'Only drill',
        path: '/d',
        group: { name: `${ROOT_CATEGORY}/Drill` },
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(2);
    expect(findExtensionsSubmenu(rootMenu)).toBeUndefined();
  });

  it('truncates long titles via truncateTitle', () => {
    const rootMenu: PanelMenuItem[] = [];
    const longTitle = 'A'.repeat(30);
    const extensions = [createLink({ title: longTitle, path: '/long' })];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub.subMenu![0].text).toBe('A'.repeat(22) + '...');
  });

  it('treats empty or whitespace group name as Extensions', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'No group', path: '/a' }),
      createLink({ title: 'Empty group', path: '/b', group: { name: '' } }),
      createLink({ title: 'Whitespace group', path: '/c', group: { name: '   ' } }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    const extSub = findExtensionsSubmenu(rootMenu)!;
    expect(extSub.subMenu!.length).toBeGreaterThanOrEqual(3);
    const texts = extSub.subMenu!.map((m) => (m.type === 'submenu' ? m.subMenu?.[0]?.text : m.text)).filter(Boolean);
    expect(texts).toContain('No group');
    expect(texts).toContain('Empty group');
    expect(texts).toContain('Whitespace group');
  });

  it('sorts root-level submenu groups by key', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Z last',
        path: '/z',
        group: { name: `${ROOT_CATEGORY}/Zebra` },
      }),
      createLink({
        title: 'A first',
        path: '/a',
        group: { name: `${ROOT_CATEGORY}/Alpha` },
      }),
    ];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions }));

    expect(rootMenu[0]).toMatchObject({ text: 'Alpha' });
    expect(rootMenu[1]).toMatchObject({ text: 'Zebra' });
  });

  it('uses custom extensionsSubmenuName', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [createLink({ title: 'Link', path: '/x' })];

    appendExtensionsToPanelMenu(createOptions({ rootMenu, extensions, extensionsSubmenuName: 'Plugin actions' }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0].text).toBe('Plugin actions');
  });
});
