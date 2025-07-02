import { Spec as UpgradeMetadataSpec } from '../../../../../apps/upgrades/plugin/src/generated/upgrademetadata/v0alpha1/types.spec.gen';
import { ScopedResourceClient } from '../../apiserver/client';
import { ResourceClient } from '../../apiserver/types';

// Define the types inline based on the backend Go types
interface DashboardPanelResult {
  dashboardUID: string;
  dashboardName: string;
  panelID: number;
  panelJSON: string;
  panelObject: object;
}

interface DashboardPanelResultList {
  items: DashboardPanelResult[];
}

class K8sAPI {
  private readonly server: ResourceClient<UpgradeMetadataSpec>;
  private readonly datasourceServer: ResourceClient<any>;

  constructor() {
    this.server = new ScopedResourceClient<UpgradeMetadataSpec>({
      group: 'upgrades.grafana.app',
      version: 'v0alpha1',
      resource: 'upgrademetadatas',
    });

    this.datasourceServer = new ScopedResourceClient<any>({
      group: 'grafana.datasource.grafana.app',
      version: 'v0alpha1',
      resource: 'connections',
    });
  }

  listUpgrades() {
    return this.server.list();
  }

  getDashboardPanelsForDataSource(dsUID: string): Promise<DashboardPanelResult[]> {
    return this.datasourceServer.subresource<DashboardPanelResultList>(dsUID, 'panels').then((r) =>
      r.items.map((item) => {
        // Handle escaped JSON string - first unescape, then parse
        let panelObject: object;
        try {
          // If panelJSON is an escaped JSON string, we need to parse it twice
          // First parse removes the escaping, second parse converts to object
          const unescapedJson = JSON.parse(item.panelJSON);
          panelObject = typeof unescapedJson === 'string' ? JSON.parse(unescapedJson) : unescapedJson;
        } catch (error) {
          console.warn('Failed to parse panel JSON for panel', item.panelID, 'in dashboard', item.dashboardUID, error);
          panelObject = {};
        }

        return {
          dashboardUID: item.dashboardUID,
          dashboardName: item.dashboardName,
          panelID: item.panelID,
          panelJSON: item.panelJSON,
          panelObject: panelObject,
        };
      })
    );
  }
}

export function getUpgradesAPI() {
  return new K8sAPI();
}
