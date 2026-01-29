import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';

import { getAPINamespace } from '../../../api/utils';

// Used in the snapshot list
export interface Snapshot {
  key: string;
  name: string;
  external: boolean;
  externalUrl?: string;
  url?: string;
}

export interface SnapshotSharingOptions {
  externalEnabled: boolean;
  externalSnapshotName: string;
  externalSnapshotURL: string;
  snapshotEnabled: boolean;
}

export interface SnapshotCreateCommand {
  dashboard: object;
  name: string;
  expires?: number;
  external?: boolean;
}

export interface SnapshotCreateResponse {
  key: string;
  url: string;
  deleteUrl: string;
}

export interface DashboardSnapshotSrv {
  create: (cmd: SnapshotCreateCommand) => Promise<SnapshotCreateResponse>;
  getSnapshots: () => Promise<Snapshot[]>;
  getSharingOptions: () => Promise<SnapshotSharingOptions>;
  deleteSnapshot: (key: string) => Promise<void>;
  getSnapshot: (key: string) => Promise<DashboardDTO>;
}

const legacyDashboardSnapshotSrv: DashboardSnapshotSrv = {
  create: (cmd: SnapshotCreateCommand) => getBackendSrv().post<SnapshotCreateResponse>('/api/snapshots', cmd),
  getSnapshots: () => getBackendSrv().get<Snapshot[]>('/api/dashboard/snapshots'),
  getSharingOptions: () => getBackendSrv().get<SnapshotSharingOptions>('/api/snapshot/shared-options'),
  deleteSnapshot: (key: string) => getBackendSrv().delete('/api/snapshots/' + key),
  getSnapshot: async (key: string) => {
    try {
      const dto = await getBackendSrv().get<DashboardDTO>('/api/snapshots/' + key);
      dto.meta.canShare = false;
      return dto;
    } catch (e) {
      throw e;
    }
  },
};

interface K8sMetadata {
  name: string;
  namespace: string;
  resourceVersion: string;
  creationTimestamp: string;
}

interface K8sSnapshotInfo {
  title: string;
  external: boolean;
  externalUrl?: string;
  expires?: number;
}

interface K8sSnapshotResource {
  metadata: K8sMetadata;
  spec: K8sSnapshotInfo;
}

interface DashboardSnapshotList {
  items: K8sSnapshotResource[];
}

// Response from the /dashboard subresource - returns a Dashboard with raw dashboard data in spec
interface K8sDashboardSubresource {
  apiVersion: string;
  kind: 'Dashboard';
  metadata: K8sMetadata;
  spec: DashboardDataDTO;
}

class K8sAPI implements DashboardSnapshotSrv {
  readonly apiVersion = 'dashboard.grafana.app/v0alpha1';
  readonly url: string;

  constructor() {
    this.url = `/apis/${this.apiVersion}/namespaces/${getAPINamespace()}/snapshots`;
  }

  async create(cmd: SnapshotCreateCommand) {
    return getBackendSrv().post<SnapshotCreateResponse>(this.url + '/create', cmd);
  }

  async getSnapshots(): Promise<Snapshot[]> {
    const result = await getBackendSrv().get<DashboardSnapshotList>(this.url);
    return result.items.map((r) => {
      return {
        key: r.metadata.name,
        name: r.spec.title,
        external: r.spec.external,
        externalUrl: r.spec.externalUrl,
      };
    });
  }

  deleteSnapshot(uid: string) {
    return getBackendSrv().delete<void>(this.url + '/' + uid);
  }

  async getSharingOptions() {
    return getBackendSrv().get<SnapshotSharingOptions>(this.url + '/settings');
  }

  async getSnapshot(uid: string): Promise<DashboardDTO> {
    const headers: Record<string, string> = {};
    if (!contextSrv.isSignedIn) {
      alert('TODO... need a barer token for anonymous use case');
      const token = `??? TODO, get anon token for snapshots (${contextSrv.user?.name}) ???`;
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch both snapshot metadata and dashboard content in parallel
    const [snapshotResponse, dashboardResponse] = await Promise.all([
      lastValueFrom(
        getBackendSrv().fetch<K8sSnapshotResource>({
          url: this.url + '/' + uid,
          method: 'GET',
          headers: headers,
        })
      ),
      lastValueFrom(
        getBackendSrv().fetch<K8sDashboardSubresource>({
          url: this.url + '/' + uid + '/dashboard',
          method: 'GET',
          headers: headers,
        })
      ),
    ]);

    const snapshot = snapshotResponse.data;
    const dashboard = dashboardResponse.data;

    return {
      dashboard: dashboard.spec,
      meta: {
        isSnapshot: true,
        canSave: false,
        canEdit: false,
        canAdmin: false,
        canStar: false,
        canShare: false,
        canDelete: false,
        isFolder: false,
        provisioned: false,
        created: snapshot.metadata.creationTimestamp,
        expires: snapshot.spec.expires?.toString(),
        k8s: snapshot.metadata,
      },
    };
  }
}

export function getDashboardSnapshotSrv(): DashboardSnapshotSrv {
  if (config.featureToggles.kubernetesSnapshots) {
    return new K8sAPI();
  }
  return legacyDashboardSnapshotSrv;
}
