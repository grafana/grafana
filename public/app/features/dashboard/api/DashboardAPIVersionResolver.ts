import { getBackendSrv } from '@grafana/runtime';
import { createDebugLog } from 'app/core/utils/debugLog';
import { type K8sAPIGroup } from 'app/features/apiserver/types';

const debugLog = createDebugLog('dashboardAPI', 'Dashboard API');

export type DashboardV1Version = 'v1' | 'v1beta1';
export type DashboardV2Version = 'v2' | 'v2beta1';

export interface ResolvedDashboardVersions {
  v1: DashboardV1Version;
  v2: DashboardV2Version;
}

const DASHBOARD_API_GROUP = 'dashboard.grafana.app';
const BETA_V1: DashboardV1Version = 'v1beta1';
const BETA_V2: DashboardV2Version = 'v2beta1';

class DashboardAPIVersionResolver {
  private resolved: ResolvedDashboardVersions | null = null;
  private resolving: Promise<ResolvedDashboardVersions> | null = null;

  /**
   * Resolve available dashboard API versions from the backend.
   * The first call triggers a network request; subsequent calls return cached result.
   * Concurrent calls share the same in-flight promise.
   */
  async resolve(): Promise<ResolvedDashboardVersions> {
    if (this.resolved) {
      return this.resolved;
    }

    if (!this.resolving) {
      this.resolving = this.discover()
        .then((versions) => {
          this.resolved = versions;
          return versions;
        })
        .catch((error) => {
          debugLog('Version discovery failed, falling back to beta versions. Will retry on next call.', error);
          const fallback: ResolvedDashboardVersions = { v1: BETA_V1, v2: BETA_V2 };
          return fallback;
        })
        .finally(() => {
          this.resolving = null;
        });
    }

    return this.resolving;
  }

  /** Whether discovery has succeeded and versions are cached. */
  get isResolved(): boolean {
    return this.resolved !== null;
  }

  getV1(): DashboardV1Version {
    if (!this.resolved) {
      debugLog('getV1() called before resolve() — falling back to beta version');
    }
    return this.resolved?.v1 ?? BETA_V1;
  }

  getV2(): DashboardV2Version {
    if (!this.resolved) {
      debugLog('getV2() called before resolve() — falling back to beta version');
    }
    return this.resolved?.v2 ?? BETA_V2;
  }

  private async discover(): Promise<ResolvedDashboardVersions> {
    const group = await getBackendSrv().get<K8sAPIGroup>(`/apis/${DASHBOARD_API_GROUP}/`, undefined, undefined, {
      showErrorAlert: false,
    });
    const availableVersions = new Set(group.versions.map((v) => v.version));
    const preferred = group.preferredVersion?.version;

    const v1: DashboardV1Version =
      preferred === 'v1' || preferred === 'v1beta1' ? preferred : availableVersions.has('v1') ? 'v1' : BETA_V1;

    const v2: DashboardV2Version =
      preferred === 'v2' || preferred === 'v2beta1' ? preferred : availableVersions.has('v2') ? 'v2' : BETA_V2;

    debugLog(
      `Version negotiation: v1=${v1}, v2=${v2}, preferred=${preferred ?? 'none'} (available: ${Array.from(availableVersions).join(', ')})`
    );

    return { v1, v2 };
  }

  /** Reset state — for testing only. */
  reset() {
    this.resolved = null;
    this.resolving = null;
  }

  /** Set resolved versions directly — for testing only. */
  set(versions: ResolvedDashboardVersions) {
    this.resolved = versions;
  }
}

export const dashboardAPIVersionResolver = new DashboardAPIVersionResolver();
