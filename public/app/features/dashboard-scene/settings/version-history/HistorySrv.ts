import { config, getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';

import { getAPINamespace } from '../../../../api/utils';

export interface HistoryListOpts {
  limit: number;
  start: number;
  continueToken?: string;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  uid: string;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
  data: Dashboard;
}

// K8s API response types
interface K8sDashboardResource {
  metadata: {
    name: string;
    generation: number;
    annotations?: {
      'grafana.app/updatedTimestamp'?: string;
      'grafana.app/updatedBy'?: string;
      'grafana.app/message'?: string;
    };
  };
  spec: Dashboard;
}

interface K8sDashboardList {
  items: K8sDashboardResource[];
  metadata: {
    continue?: string;
  };
}

/**
 * Interface for dashboard version history service
 */
export interface DashboardHistorySrv {
  getHistoryList(
    dashboardUID: string,
    options: HistoryListOpts
  ): Promise<{ versions: RevisionsModel[]; continueToken?: string }>;
  getDashboardVersion(dashboardUID: string, version: number): Promise<RevisionsModel | Record<string, never>>;
  restoreDashboard(dashboardUID: string, version: number): Promise<unknown>;
}

/**
 * Legacy implementation using /api/ endpoints
 */
export class LegacyHistorySrv implements DashboardHistorySrv {
  getHistoryList(
    dashboardUID: string,
    options: HistoryListOpts
  ): Promise<{ versions: RevisionsModel[]; continueToken?: string }> {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve({ versions: [] });
    }

    return getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions`, options);
  }

  getDashboardVersion(dashboardUID: string, version: number) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve({});
    }

    return getBackendSrv().get(`api/dashboards/uid/${dashboardUID}/versions/${version}`);
  }

  restoreDashboard(dashboardUID: string, version: number) {
    if (typeof dashboardUID !== 'string') {
      return Promise.resolve({});
    }

    const url = `api/dashboards/uid/${dashboardUID}/restore`;

    return getBackendSrv().post(url, { version });
  }
}

/**
 * K8s implementation using /apis/ endpoints with label selectors
 */
export class K8sHistorySrv implements DashboardHistorySrv {
  private readonly apiVersion = 'dashboard.grafana.app/v0alpha1';

  private getBaseUrl(): string {
    const namespace = getAPINamespace();
    return `/apis/${this.apiVersion}/namespaces/${namespace}/dashboards`;
  }

  async getHistoryList(
    dashboardUID: string,
    options: HistoryListOpts
  ): Promise<{ versions: RevisionsModel[]; continueToken?: string }> {
    if (typeof dashboardUID !== 'string') {
      return { versions: [] };
    }

    const params = new URLSearchParams();
    params.set('labelSelector', 'grafana.app/get-history=true');
    params.set('fieldSelector', `metadata.name=${dashboardUID}`);
    if (options.limit) {
      params.set('limit', String(options.limit));
    }
    if (options.continueToken) {
      params.set('continue', options.continueToken);
    }

    const url = `${this.getBaseUrl()}?${params.toString()}`;
    const response: K8sDashboardList = await getBackendSrv().get(url);

    const versions = response.items.map((item) => this.transformToRevisionsModel(item, dashboardUID));

    return {
      versions,
      continueToken: response.metadata.continue,
    };
  }

  async getDashboardVersion(dashboardUID: string, version: number): Promise<RevisionsModel | Record<string, never>> {
    if (typeof dashboardUID !== 'string') {
      return {};
    }

    // For K8s, we need to list with history label and find the specific version
    const params = new URLSearchParams();
    params.set('labelSelector', 'grafana.app/get-history=true');
    params.set('fieldSelector', `metadata.name=${dashboardUID}`);

    const url = `${this.getBaseUrl()}?${params.toString()}`;
    const response: K8sDashboardList = await getBackendSrv().get(url);

    const item = response.items.find((item) => item.metadata.generation === version);
    if (!item) {
      return {};
    }

    return this.transformToRevisionsModel(item, dashboardUID);
  }

  async restoreDashboard(dashboardUID: string, version: number): Promise<unknown> {
    if (typeof dashboardUID !== 'string') {
      return {};
    }

    // Get the specific version
    const versionData = await this.getDashboardVersion(dashboardUID, version);
    if (!versionData || !('data' in versionData)) {
      throw new Error(`Version ${version} not found for dashboard ${dashboardUID}`);
    }

    // PUT the dashboard with the spec from the old version
    const url = `${this.getBaseUrl()}/${dashboardUID}`;
    const currentDashboard: K8sDashboardResource = await getBackendSrv().get(url);

    // Update the spec with the old version's data
    const updatedDashboard = {
      ...currentDashboard,
      spec: versionData.data,
      metadata: {
        ...currentDashboard.metadata,
        annotations: {
          ...currentDashboard.metadata.annotations,
          'grafana.app/message': `Restored from version ${version}`,
        },
      },
    };

    return getBackendSrv().put(url, updatedDashboard);
  }

  private transformToRevisionsModel(item: K8sDashboardResource, dashboardUID: string): RevisionsModel {
    const annotations = item.metadata.annotations || {};
    const createdTimestamp = annotations['grafana.app/updatedTimestamp'];

    return {
      id: item.metadata.generation,
      checked: false,
      uid: dashboardUID,
      parentVersion: item.metadata.generation > 1 ? item.metadata.generation - 1 : 0,
      version: item.metadata.generation,
      created: createdTimestamp ? new Date(createdTimestamp) : new Date(),
      createdBy: annotations['grafana.app/updatedBy'] || '',
      message: annotations['grafana.app/message'] || '',
      data: item.spec,
    };
  }
}

/**
 * Factory function to create the appropriate history service based on feature flag
 */
export function createHistorySrv(): DashboardHistorySrv {
  if (config.featureToggles.kubernetesDashboardVersions) {
    return new K8sHistorySrv();
  }
  return new LegacyHistorySrv();
}

// Backwards compatibility: HistorySrv is an alias for LegacyHistorySrv
export class HistorySrv extends LegacyHistorySrv {}

// Create the default instance using the factory
const historySrv = createHistorySrv();
export { historySrv };
