import { useMemo } from 'react';

import { PluginExtensionCommandPaletteContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

// NOTE: we are defining this here, as if we would define it in the hook, it would be recreated on every render, which would cause unnecessary re-renders.
const context: PluginExtensionCommandPaletteContext = {};

export default function useExtensionActions(): CommandPaletteAction[] {
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.CommandPalette,
    context,
    limitPerPlugin: 40,
  });

  return useMemo(() => {
    return links.map((link) => ({
      section: link.category ?? 'Extensions',
      priority: EXTENSIONS_PRIORITY,
      id: link.id,
      name: link.title,
      perform: () => link.onClick && link.onClick(),
      url: link.path,
    }));
  }, [links]);
}
