import { getBackendSrv } from '@grafana/runtime';
import { DashboardDTO } from 'app/types';

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

export interface DashboardSnapshotSrv {
  getSnapshots: () => Promise<Snapshot[]>;
  getSharingOptions: () => Promise<SnapshotSharingOptions>;
  deleteSnapshot: (key: string) => Promise<void>;
  getSnapshot: (key: string) => Promise<DashboardDTO>;
}

const legacyDashboardSnapshotSrv: DashboardSnapshotSrv = {
  getSnapshots: () => getBackendSrv().get<Snapshot[]>('/api/dashboard/snapshots'),
  getSharingOptions: () => getBackendSrv().get<SnapshotSharingOptions>('/api/snapshot/shared-options'),
  deleteSnapshot: (key: string) => getBackendSrv().delete('/api/snapshots/' + key),
  getSnapshot: async (key: string) => {
    const dto = await getBackendSrv().get<DashboardDTO>('/api/snapshots/' + key);
    dto.meta.canShare = false;
    return dto;
  },
};

export function getDashboardSnapshotSrv(): DashboardSnapshotSrv {
  return legacyDashboardSnapshotSrv;
}
