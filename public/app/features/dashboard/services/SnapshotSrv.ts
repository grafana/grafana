import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardDTO } from 'app/types';

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
  getSnapshots: () => backendSrv.get<Snapshot[]>('/api/dashboard/snapshots'),
  deleteSnapshot: (key: string) => backendSrv.delete('/api/snapshots/' + key),
  getSnapshot: (key: string) => backendSrv.get<DashboardDTO>('/api/snapshots/' + key),
};

export function getDashboardSnapshotSrv(): DashboardSnapshotSrv {
  return legacyDashboardSnapshotSrv;
}
