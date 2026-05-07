import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isResource } from 'app/features/apiserver/guards';
import { type Resource, type ResourceList } from 'app/features/apiserver/types';
import { type DashboardDataDTO, type DashboardDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';
import { VERSIONS_FETCH_LIMIT } from '../types/revisionModels';

import {
  type DashboardAPI,
  DashboardVersionError,
  type DashboardWithAccessInfo,
  type ListDashboardHistoryOptions,
  type ListDeletedDashboardsOptions,
} from './types';
import {
  failedFromVersion,
  isDashboardV2Spec,
  isV1DashboardCommand,
  isV2DashboardCommand,
  isV2StoredVersion,
} from './utils';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';

interface CompositeContinueToken {
  v1?: string;
  v2?: string;
}

function encodeCompositeToken(v1?: string, v2?: string): string | undefined {
  if (!v1 && !v2) {
    return undefined;
  }
  return btoa(JSON.stringify({ v1, v2 }));
}

function decodeCompositeToken(token?: string): CompositeContinueToken {
  if (!token) {
    return {};
  }
  try {
    return JSON.parse(atob(token));
  } catch {
    return { v1: token };
  }
}

function sortByGenerationDesc<T extends Resource<unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.metadata.generation ?? 0) - (a.metadata.generation ?? 0));
}

export class UnifiedDashboardAPI
  implements DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec>
{
  private v1Client: K8sDashboardAPI;
  private v2Client: K8sDashboardV2API;

  constructor() {
    this.v1Client = new K8sDashboardAPI();
    this.v2Client = new K8sDashboardV2API();
  }

  async getDashboardDTO(uid: string) {
    try {
      return await this.v1Client.getDashboardDTO(uid);
    } catch (error) {
      if (error instanceof DashboardVersionError && isV2StoredVersion(error.data.storedVersion)) {
        return await this.v2Client.getDashboardDTO(uid);
      }
      throw error;
    }
  }

  async saveDashboard(options: SaveDashboardCommand<Dashboard | DashboardV2Spec>) {
    if (isV2DashboardCommand(options)) {
      return await this.v2Client.saveDashboard(options);
    }
    if (isV1DashboardCommand(options)) {
      return await this.v1Client.saveDashboard(options);
    }
    throw new Error('Invalid dashboard command');
  }

  async deleteDashboard(uid: string, showSuccessAlert: boolean) {
    return await this.v1Client.deleteDashboard(uid, showSuccessAlert);
  }

  async listDashboardHistory(uid: string, options?: ListDashboardHistoryOptions) {
    const limit = options?.limit ?? VERSIONS_FETCH_LIMIT;
    const { v1: v1Token, v2: v2Token } = decodeCompositeToken(options?.continueToken);

    const v1Response = await this.v1Client.listDashboardHistory(uid, { limit, continueToken: v1Token });
    const v1Valid = v1Response.items.filter((item) => !failedFromVersion(item, ['v2']));

    if (v1Valid.length === v1Response.items.length && v1Response.items.length > 0) {
      return {
        ...v1Response,
        metadata: {
          ...v1Response.metadata,
          continue: encodeCompositeToken(v1Response.metadata.continue, v2Token),
        },
      };
    }

    const v2Response = await this.v2Client.listDashboardHistory(uid, { limit, continueToken: v2Token });
    const v2Valid = v2Response.items.filter((item) => !failedFromVersion(item, ['v0', 'v1']));

    if (v1Valid.length === 0) {
      return {
        ...v2Response,
        metadata: {
          ...v2Response.metadata,
          continue: encodeCompositeToken(v1Response.metadata.continue, v2Response.metadata.continue),
        },
      };
    }

    // Both APIs return the same generation sequence; every generation is valid in
    // exactly one stream, so v1Valid + v2Valid reconstructs the full range.
    const merged = sortByGenerationDesc([...v1Valid, ...v2Valid].filter(isResource));

    return {
      ...v1Response,
      items: merged,
      metadata: {
        ...v1Response.metadata,
        continue: encodeCompositeToken(v1Response.metadata.continue, v2Response.metadata.continue),
      },
    };
  }

  async getDashboardHistoryVersions(uid: string, versions: number[]) {
    try {
      return await this.v1Client.getDashboardHistoryVersions(uid, versions);
    } catch (error) {
      return await this.v2Client.getDashboardHistoryVersions(uid, versions);
    }
  }

  async restoreDashboardVersion(uid: string, version: number) {
    return await this.v1Client.restoreDashboardVersion(uid, version);
  }

  async listDeletedDashboards(
    options: ListDeletedDashboardsOptions
  ): Promise<ResourceList<Dashboard | DashboardV2Spec>> {
    const { v1: v1Token, v2: v2Token } = decodeCompositeToken(options.continue);

    const v1Response = await this.v1Client.listDeletedDashboards({ ...options, continue: v1Token });
    const v1Valid = v1Response.items.filter((item) => !failedFromVersion(item, ['v2']));

    if (v1Valid.length === v1Response.items.length && v1Response.items.length > 0) {
      return {
        ...v1Response,
        metadata: {
          ...v1Response.metadata,
          continue: encodeCompositeToken(v1Response.metadata.continue, v2Token),
        },
      };
    }

    const v2Response = await this.v2Client.listDeletedDashboards({ ...options, continue: v2Token });
    const v2Valid = v2Response.items.filter((item) => !failedFromVersion(item, ['v0', 'v1']));

    if (v1Valid.length === 0) {
      return {
        ...v2Response,
        metadata: {
          ...v2Response.metadata,
          continue: encodeCompositeToken(v1Response.metadata.continue, v2Response.metadata.continue),
        },
      };
    }

    const merged = [...v1Valid, ...v2Valid].filter(isResource);

    return {
      ...v1Response,
      items: merged,
      metadata: {
        ...v1Response.metadata,
        continue: encodeCompositeToken(v1Response.metadata.continue, v2Response.metadata.continue),
      },
    };
  }

  async restoreDashboard(dashboard: Resource<DashboardDataDTO | DashboardV2Spec>) {
    if (isDashboardV2Spec(dashboard.spec) && isResource<DashboardV2Spec>(dashboard)) {
      return await this.v2Client.restoreDashboard(dashboard);
    }

    if (isResource<DashboardDataDTO>(dashboard)) {
      return await this.v1Client.restoreDashboard(dashboard);
    }
    throw new Error('Invalid dashboard resource for restore operation');
  }
}
