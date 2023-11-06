import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { backendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

// Used in the snapshot list
export interface Snapshot {
  key: string;
  name: string;
  external: boolean;
  externalUrl?: string;
  url?: string;
}

export interface DashboardSnapshotSrv {
  getSnapshots: () => Promise<Snapshot[]>;
  deleteSnapshot: (key: string) => Promise<void>;
  getSnapshot: (key: string) => Promise<DashboardDTO>;
}

const legacyDashboardSnapshotSrv: DashboardSnapshotSrv = {
  getSnapshots: () => backendSrv.get<Snapshot[]>('/api/snapshots/'),
  deleteSnapshot: (key: string) => backendSrv.delete('/api/snapshots/' + key),
  getSnapshot: (key: string) => backendSrv.get<DashboardDTO>('/api/snapshots/' + key),
};

interface K8sMetadata {
  name: string;
  namespace: string;
  resourceVersion: string;
  creationTimestamp: string;
}

interface K8sSnapshotSummary {
  metadata: K8sMetadata;
  title: string;
  externalUrl?: string;
  expires?: number;
}

interface DashboardSnapshotList {
  items: K8sSnapshotSummary[];
}

interface K8sDashboardSnapshot {
  apiVersion: string;
  kind: 'DashboardSnapshot';
  metadata: K8sMetadata;
  dashboard: DashboardDataDTO;
}

class K8sAPI implements DashboardSnapshotSrv {
  readonly apiVersion = 'snapshots.grafana.app/v0alpha1';
  readonly url: string;

  constructor() {
    const ns = contextSrv.user.orgId === 1 ? 'default' : `org-${contextSrv.user.orgId}`;
    this.url = `/apis/${this.apiVersion}/namespaces/${ns}/dashboards`;
  }

  async getSnapshots(): Promise<Snapshot[]> {
    const result = await getBackendSrv().get<DashboardSnapshotList>(this.url);
    return result.items.map((v) => {
      return {
        external: v.externalUrl != null,
        externalUrl: v.externalUrl,
        key: v.metadata.name,
        name: v.title,
      };
    });
  }

  deleteSnapshot(uid: string) {
    return getBackendSrv().delete<void>(this.url + '/' + uid);
  }

  async getSnapshot(uid: string): Promise<DashboardDTO> {
    const v = await getBackendSrv().get<K8sDashboardSnapshot>(this.url + '/' + uid);
    return {
      dashboard: v.dashboard,
      meta: {
        isSnapshot: true,
        canSave: false,
        canEdit: false,
        canAdmin: false,
        canStar: false,
        canShare: false,
        canDelete: false,
        isFolder: false,
        folderId: 0,
        provisioned: false,
        provisionedExternalId: '',
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
