import { PluginExtensionCommandPaletteContext, PluginExtensionPoints } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';

import { CommandPaletteAction } from '../types';
import { EXTENSIONS_PRIORITY } from '../values';

export default function getExtensionActions(): CommandPaletteAction[] {
  const context: PluginExtensionCommandPaletteContext = {};
  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.CommandPalette,
    context,
    limitPerPlugin: 3,
  });
  return extensions.map((extension) => ({
    section: extension.category ?? 'Extensions',
    priority: EXTENSIONS_PRIORITY,
    id: extension.id,
    name: extension.title,
    target: extension.path,
    perform: () => extension.onClick && extension.onClick(),
  }));
}
