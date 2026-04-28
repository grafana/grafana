import { useMemo } from 'react';

import { type PluginExtensionCommandPaletteContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

import { type CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

// NOTE: we are defining this here, as if we would define it in the hook, it would be recreated on every render, which would cause unnecessary re-renders.
const context: PluginExtensionCommandPaletteContext = {};

export default function useExtensionActions(): CommandPaletteAction[] {
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.CommandPalette,
    context,
    limitPerPlugin: 80,
  });

  return useMemo(() => {
    const actions: CommandPaletteAction[] = [];
    const groupParents = new Map<string, string>();

    for (const link of links) {
      const section = link.group?.name?.trim() || link.category || 'Extensions';
      const base = {
        id: link.id,
        name: link.title,
        section,
        priority: EXTENSIONS_PRIORITY,
        perform: () => link.onClick?.(),
        url: link.path,
      };

      const groupName = link.group?.name?.trim();
      if (groupName) {
        const groupKey = `${link.pluginId}/${groupName}`;

        if (!groupParents.has(groupKey)) {
          const parentId = `ext-group/${groupKey}`;
          groupParents.set(groupKey, parentId);
          actions.push({
            id: parentId,
            name: groupName,
            section,
            priority: EXTENSIONS_PRIORITY,
          });
        }

        actions.push({ ...base, parent: groupParents.get(groupKey)! });
      } else {
        actions.push(base);
      }
    }

    return actions;
  }, [links]);
}
