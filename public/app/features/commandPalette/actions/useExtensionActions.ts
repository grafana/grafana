import { useMemo } from 'react';

import { PluginExtensionCommandPaletteContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinkExtensions } from '@grafana/runtime';

import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

// NOTE: we are defining this here, as if we would define it in the hook, it would be recreated on every render, which would cause unnecessary re-renders.
const context: PluginExtensionCommandPaletteContext = {};

export default function useExtensionActions(): CommandPaletteAction[] {
  const { extensions } = usePluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.CommandPalette,
    context,
    limitPerPlugin: 3,
  });

  return useMemo(() => {
    return extensions.map((extension) => ({
      section: extension.category ?? 'Extensions',
      priority: EXTENSIONS_PRIORITY,
      id: extension.id,
      name: extension.title,
      target: extension.path,
      perform: () => extension.onClick && extension.onClick(),
    }));
  }, [extensions]);
}
