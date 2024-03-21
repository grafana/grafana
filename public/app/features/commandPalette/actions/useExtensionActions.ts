import { useMemo } from 'react';

import { PluginExtensionCommandPaletteContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginLinkExtensions } from '@grafana/runtime';

import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

export default function useExtensionActions(): CommandPaletteAction[] {
  const context: PluginExtensionCommandPaletteContext = {};
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
