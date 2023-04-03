import { PluginExtensionLinkConfig } from '@grafana/data';

import { MAX_EXTENSIONS_PER_PLACEMENT_PER_PLUGIN } from './constants';

export class PlacementsPerPlugin {
  private extensionsByPlacement: Record<string, string[]> = {};

  allowedToAdd({ placement, title }: PluginExtensionLinkConfig): boolean {
    if (this.countByPlacement(placement) >= MAX_EXTENSIONS_PER_PLACEMENT_PER_PLUGIN) {
      return false;
    }

    this.addExtensionToPlacement(placement, title);

    return true;
  }

  addExtensionToPlacement(placement: string, extensionTitle: string) {
    if (!this.extensionsByPlacement[placement]) {
      this.extensionsByPlacement[placement] = [];
    }

    this.extensionsByPlacement[placement].push(extensionTitle);
  }

  countByPlacement(placement: string) {
    return this.extensionsByPlacement[placement]?.length ?? 0;
  }

  getExtensionTitlesByPlacement(placement: string) {
    return this.extensionsByPlacement[placement];
  }
}
