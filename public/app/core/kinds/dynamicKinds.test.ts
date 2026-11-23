import { type KindInfo } from '@grafana/runtime/unstable';

import { CORE_KINDS } from './coreKinds';
import { addKinds, findKind, getKinds } from './dynamicKinds';

const group = 'example.ext.grafana.app';

function pluginKind(kind: string, label: string): KindInfo {
  return {
    group,
    kind,
    resource: `${kind.toLowerCase()}s`,
    folderScoped: false,
    getLabel: () => label,
    getPluralLabel: () => `${label}s`,
    icon: 'tag-alt',
  };
}

describe('dynamic kinds', () => {
  it('finds a kind that a plugin adds by its group and kind', () => {
    const note = pluginKind('Note', 'Note');
    addKinds([note]);

    expect(findKind(group, 'Note')).toBe(note);
    expect(findKind('other.ext.grafana.app', 'Note')).toBeUndefined();
  });

  it('keeps the core row when a plugin adds a kind that Grafana serves', () => {
    addKinds([{ ...pluginKind('Dashboard', 'Plugin dashboard'), group: 'dashboard.grafana.app' }]);

    expect(findKind('dashboard.grafana.app', 'Dashboard')).toBe(CORE_KINDS.dashboard);
    expect(getKinds().filter((kind) => kind.kind === 'Dashboard')).toEqual([CORE_KINDS.dashboard]);
  });

  it('replaces a plugin kind that a plugin adds again', () => {
    addKinds([pluginKind('Widget', 'Old widget')]);
    addKinds([pluginKind('Widget', 'New widget')]);

    expect(getKinds().filter((kind) => kind.kind === 'Widget')).toHaveLength(1);
    expect(findKind(group, 'Widget')?.getLabel()).toBe('New widget');
  });

  it('lists the core kinds before the plugin kinds', () => {
    const gadget = pluginKind('Gadget', 'Gadget');
    addKinds([gadget]);

    const kinds = getKinds();
    expect(kinds.slice(0, Object.values(CORE_KINDS).length)).toEqual(Object.values(CORE_KINDS));
    expect(kinds.at(-1)).toBe(gadget);
  });
});
