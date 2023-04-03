import { PluginExtensionLinkConfig } from '@grafana/data';

import { MAX_EXTENSIONS_PER_EXTENSION_POINT_PER_PLUGIN } from './constants';

export class ExtensionsPerPlugin {
  private extensionsByExtensionPoint: Record<string, string[]> = {};

  allowedToAdd({ extensionPointId, title }: PluginExtensionLinkConfig): boolean {
    if (this.countByExtensionPoint(extensionPointId) >= MAX_EXTENSIONS_PER_EXTENSION_POINT_PER_PLUGIN) {
      return false;
    }

    this.addExtensionToExtensionPoint(extensionPointId, title);

    return true;
  }

  addExtensionToExtensionPoint(extensionPointId: string, extensionTitle: string) {
    if (!this.extensionsByExtensionPoint[extensionPointId]) {
      this.extensionsByExtensionPoint[extensionPointId] = [];
    }

    this.extensionsByExtensionPoint[extensionPointId].push(extensionTitle);
  }

  countByExtensionPoint(extensionPointId: string) {
    return this.extensionsByExtensionPoint[extensionPointId]?.length ?? 0;
  }

  getExtensionTitlesByExtensionPoint(extensionPointId: string) {
    return this.extensionsByExtensionPoint[extensionPointId];
  }
}
