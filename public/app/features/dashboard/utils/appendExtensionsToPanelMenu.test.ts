import { PanelMenuItem, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';

import { appenExtensionsToPanelMenu, AppendToPanelMenuOpts } from './appendExtensionsToPanelMenu';

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

function createOpts(overrides: Partial<AppendToPanelMenuOpts> = {}): AppendToPanelMenuOpts {
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

describe('appenExtensionsToPanelMenu', () => {
  it('does nothing when extensions is empty', () => {
    const rootMenu: PanelMenuItem[] = [];
    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions: [] }));
    expect(rootMenu).toHaveLength(0);
  });

  it('appends extension without group/category to Extensions submenu with divider before it', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [createLink({ title: 'Declare incident', path: '/a/declare' })];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(2);
    expect(rootMenu[0]).toMatchObject({ text: 'divider', type: 'divider' });
    expect(rootMenu[1]).toMatchObject({
      text: 'Extensions',
      type: 'submenu',
      iconClassName: 'plug',
    });
    const extSub = rootMenu[1];
    expect(extSub.subMenu).toHaveLength(1);
    expect(extSub.subMenu![0]).toMatchObject({
      text: 'Declare incident',
      href: '/a/declare',
    });
  });

  it('maps path, icon, onClick, openInNewTab to panel menu item', () => {
    const rootMenu: PanelMenuItem[] = [];
    const onClick = jest.fn();
    const extensions = [
      createLink({
        title: 'Action',
        path: '/action',
        icon: 'info',
        onClick,
        openInNewTab: true,
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const extSub = rootMenu[1];
    const item = extSub.subMenu![0];
    expect(item.href).toBe('/action');
    expect(item.iconClassName).toBe('info');
    expect(item.target).toBe('_blank');
    item.onClick?.({} as React.MouseEvent);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('appends group.name ${root} items directly to rootMenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Root Action',
        path: '/root',
        group: { name: '${root}' },
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({ text: 'Root Action', href: '/root' });
  });

  it('spreads multiple ${root} items into rootMenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'A', path: '/a', group: { name: '${root}' } }),
      createLink({ title: 'B', path: '/b', group: { name: '${root}' } }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(2);
    expect(rootMenu[0]).toMatchObject({ text: 'A', href: '/a' });
    expect(rootMenu[1]).toMatchObject({ text: 'B', href: '/b' });
  });

  it('creates root-level submenu for group.name ${root}/SubmenuName', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Drilldown Action',
        path: '/drill',
        group: { name: '${root}/Metrics drilldown', icon: 'code-branch' },
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({
      text: 'Metrics drilldown',
      type: 'submenu',
      iconClassName: 'code-branch',
    });
    expect(rootMenu[0].subMenu).toHaveLength(1);
    expect(rootMenu[0].subMenu![0]).toMatchObject({
      text: 'Drilldown Action',
      href: '/drill',
    });
  });

  it('puts extension with category (no group) under Extensions as named submenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Declare incident',
        path: '/declare',
        category: 'Incident',
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const incidentSub = findMenuItemByText(rootMenu, 'Incident');
    expect(incidentSub).toBeDefined();
    expect(incidentSub!.type).toBe('submenu');
    expect(incidentSub!.subMenu).toHaveLength(1);
    expect(incidentSub!.subMenu![0]).toMatchObject({ text: 'Declare incident', href: '/declare' });
  });

  it('uses metrics-drilldown category as ${root}/Metrics drilldown with icon', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Drill',
        path: '/drill',
        category: 'metrics-drilldown',
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    expect(rootMenu[0]).toMatchObject({
      text: 'Metrics drilldown',
      type: 'submenu',
      iconClassName: 'code-branch',
    });
    expect(rootMenu[0].subMenu![0]).toMatchObject({ text: 'Drill', href: '/drill' });
  });

  it('groups multiple extensions in same ${root}/Sub into one submenu', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'One', path: '/1', group: { name: '${root}/Testing' } }),
      createLink({ title: 'Two', path: '/2', group: { name: '${root}/Testing' } }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(1);
    const sub = rootMenu[0];
    expect(sub.text).toBe('Testing');
    expect(sub.subMenu).toHaveLength(2);
    expect(sub.subMenu![0]).toMatchObject({ text: 'One', href: '/1' });
    expect(sub.subMenu![1]).toMatchObject({ text: 'Two', href: '/2' });
  });

  it('orders: root items, then divider + Extensions, then root submenus (sorted group keys)', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({ title: 'Root', path: '/r', group: { name: '${root}' } }),
      createLink({ title: 'In Sub', path: '/s', group: { name: '${root}/Sub' } }),
      createLink({ title: 'Ungrouped', path: '/u' }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const texts = rootMenu.map((m) => m.text);
    expect(texts).toContain('Root');
    expect(texts).toContain('divider');
    expect(texts).toContain('Extensions');
    expect(texts).toContain('Sub');
    const rootIdx = texts.indexOf('Root');
    const divIdx = texts.indexOf('divider');
    const extIdx = texts.indexOf('Extensions');
    expect(rootIdx).toBeLessThan(divIdx);
    expect(divIdx).toBeLessThan(extIdx);
  });

  it('uses extensionsSubmenuName for the Extensions submenu label', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [createLink({ title: 'X', path: '/x' })];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions, extensionsSubmenuName: 'Plugin actions' }));

    expect(rootMenu[1]).toMatchObject({ text: 'Plugin actions', type: 'submenu' });
  });

  it('truncates long titles to 25 chars using truncateTitle', () => {
    const rootMenu: PanelMenuItem[] = [];
    const longTitle = 'This is a very long menu item title that should be truncated';
    const extensions = [createLink({ title: longTitle, path: '/long' })];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const extSub = findMenuItemByText(rootMenu, 'Extensions');
    expect(extSub).toBeDefined();
    const item = extSub!.subMenu![0];
    // truncateTitle slices (0, 22), trimEnd, then adds '...' → "This is a very long me..."
    expect(item.text).toBe('This is a very long me...');
  });

  it('truncates long group names to 25 chars using truncateTitle', () => {
    const rootMenu: PanelMenuItem[] = [];
    const longGroupName = 'This is a very long submenu name';
    const extensions = [
      createLink({
        title: 'Action',
        path: '/p',
        group: { name: `\${root}/${longGroupName}` },
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const sub = rootMenu[0];
    // truncateTitle("This is a very long submenu name", 25) → "This is a very long su..."
    expect(sub.text).toBe('This is a very long su...');
  });

  it('mutates existing rootMenu without clearing it', () => {
    const rootMenu: PanelMenuItem[] = [{ text: 'Existing', type: 'submenu' }];
    const extensions = [createLink({ title: 'New', path: '/new', group: { name: '${root}' } })];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    expect(rootMenu).toHaveLength(2);
    expect(rootMenu[0]).toMatchObject({ text: 'Existing' });
    expect(rootMenu[1]).toMatchObject({ text: 'New', href: '/new' });
  });

  it('group.name without ${root} creates submenu under Extensions', () => {
    const rootMenu: PanelMenuItem[] = [];
    const extensions = [
      createLink({
        title: 'Declare',
        path: '/d',
        group: { name: 'Incident', icon: 'bell' },
      }),
    ];

    appenExtensionsToPanelMenu(createOpts({ rootMenu, extensions }));

    const incidentSub = findMenuItemByText(rootMenu, 'Incident');
    expect(incidentSub).toBeDefined();
    expect(incidentSub!.iconClassName).toBe('bell');
    expect(incidentSub!.subMenu![0]).toMatchObject({ text: 'Declare', href: '/d' });
  });
});
