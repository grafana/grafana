import { Spec as UpgradeMetadataSpec } from '../../../../../apps/upgrades/plugin/src/generated/upgrademetadata/v0alpha1/types.spec.gen';
import { ScopedResourceClient } from '../../apiserver/client';
import { ResourceClient } from '../../apiserver/types';

class K8sAPI {
  private readonly server: ResourceClient<UpgradeMetadataSpec>;

  constructor() {
    this.server = new ScopedResourceClient<UpgradeMetadataSpec>({
      group: 'upgrades.grafana.app',
      version: 'v0alpha1',
      resource: 'upgrademetadatas',
    });
  }

  listUpgrades() {
    return this.server.list();
  }
}

export function getUpgradesAPI() {
  return new K8sAPI();
}
