import { config, getBackendSrv } from '@grafana/runtime';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { type DashboardDataDTO, type DashboardDTO } from 'app/types/dashboard';
import { dispatch } from 'app/types/store';

// Used in the snapshot list
export interface Snapshot {
  key: string;
  name: string;
  external: boolean;
  externalUrl?: string;
  url?: string;
}

export interface SnapshotListPage {
  items: Snapshot[];
  continueToken?: string;
}

export interface SnapshotListOptions {
  continue?: string;
}

export interface SnapshotSharingOptions {
  externalEnabled: boolean;
  externalSnapshotName: string;
  externalSnapshotURL: string;
  snapshotEnabled: boolean;
}

interface SnapshotCreateCommand {
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
  getSnapshots: (opts?: SnapshotListOptions) => Promise<SnapshotListPage>;
  getSharingOptions: () => Promise<SnapshotSharingOptions>;
  deleteSnapshot: (key: string) => Promise<void>;
  getSnapshot: (key: string) => Promise<DashboardDTO>;
}

const legacyDashboardSnapshotSrv: DashboardSnapshotSrv = {
  create: (cmd: SnapshotCreateCommand) => getBackendSrv().post<SnapshotCreateResponse>('/api/snapshots', cmd),
  getSnapshots: async () => {
    const items = await getBackendSrv().get<Snapshot[]>('/api/dashboard/snapshots');
    return { items, continueToken: undefined };
  },
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

function mapK8sSnapshotItem(item: {
  metadata: { name?: string };
  spec: { title?: string; external?: boolean; externalUrl?: string };
}): Snapshot {
  return {
    key: item.metadata.name ?? '',
    name: item.spec.title ?? '',
    external: item.spec.external ?? false,
    externalUrl: item.spec.externalUrl,
  };
}

class K8sAPI implements DashboardSnapshotSrv {
  async create(cmd: SnapshotCreateCommand): Promise<SnapshotCreateResponse> {
    // CreateSnapshotApiResponse is `any` in the generated types; the legacy backend
    // returns SnapshotCreateResponse and the k8s endpoint preserves the same shape.
    return await dispatch(dashboardAPIv0alpha1.endpoints.createSnapshot.initiate({ body: cmd })).unwrap();
  }

  async getSnapshots(opts?: SnapshotListOptions): Promise<SnapshotListPage> {
    // Imperative query dispatches auto-subscribe to RTK's cache. Releasing the
    // subscription in `finally` ensures a subsequent deleteSnapshot mutation (which
    // invalidates the Snapshot tag) doesn't trigger a stale background refetch.
    const promise = dispatch(
      dashboardAPIv0alpha1.endpoints.listSnapshot.initiate({ continue: opts?.continue }, { forceRefetch: true })
    );
    try {
      const result = await promise.unwrap();
      return {
        items: result.items.map(mapK8sSnapshotItem),
        continueToken: result.metadata.continue,
      };
    } finally {
      promise.unsubscribe();
    }
  }

  async deleteSnapshot(uid: string) {
    await dispatch(dashboardAPIv0alpha1.endpoints.deleteSnapshot.initiate({ name: uid })).unwrap();
  }

  async getSharingOptions(): Promise<SnapshotSharingOptions> {
    // GetSnapshotSettingsApiResponse is `any` in the generated types; the backend
    // returns the same SnapshotSharingOptions shape as the legacy endpoint.
    const promise = dispatch(
      dashboardAPIv0alpha1.endpoints.getSnapshotSettings.initiate(undefined, { forceRefetch: true })
    );
    try {
      return await promise.unwrap();
    } finally {
      promise.unsubscribe();
    }
  }

  async getSnapshot(uid: string): Promise<DashboardDTO> {
    // For anonymous callers (`org-0`) the dashboard v0alpha1 baseAPI routes these
    // read-by-key endpoints to the `default` namespace, so the public snapshot view works
    // through RTK like every other method.
    const snapshotPromise = dispatch(
      dashboardAPIv0alpha1.endpoints.getSnapshot.initiate({ name: uid }, { forceRefetch: true })
    );
    const dashboardPromise = dispatch(
      dashboardAPIv0alpha1.endpoints.getSnapshotDashboard.initiate({ name: uid }, { forceRefetch: true })
    );
    try {
      const [snapshotResponse, dashboardResponse] = await Promise.all([
        snapshotPromise.unwrap(),
        dashboardPromise.unwrap(),
      ]);

      // The /dashboard subresource returns a Dashboard whose `spec` is the raw dashboard
      // payload — typed as `Unstructured` in the generated client, but always a
      // DashboardDataDTO at runtime.
      // structuredClone unfreezes the payload: RTK Query auto-freezes responses, but
      // downstream dashboard processing (e.g. fixThresholds in getPanelOptionsWithDefaults)
      // mutates fields like thresholds.steps[0].value in place and would throw on a
      // frozen object.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const dashboard = structuredClone(dashboardResponse.spec) as DashboardDataDTO;

      return {
        dashboard,
        meta: {
          isSnapshot: true,
          version: 0,
          k8s: snapshotResponse.metadata,
        },
      };
    } finally {
      snapshotPromise.unsubscribe();
      dashboardPromise.unsubscribe();
    }
  }
}

export function getDashboardSnapshotSrv(): DashboardSnapshotSrv {
  if (config.featureToggles.kubernetesSnapshots) {
    return new K8sAPI();
  }
  return legacyDashboardSnapshotSrv;
}
