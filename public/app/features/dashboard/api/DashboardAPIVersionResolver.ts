import { config, getBackendSrv } from '@grafana/runtime';
import { createDebugLog } from 'app/core/utils/debugLog';
import { type K8sAPIGroup } from 'app/features/apiserver/types';

const debugLog = createDebugLog('dashboardAPI', 'Dashboard API');

export type DashboardV1Version = 'v1' | 'v1beta1';
export type DashboardV2Version = 'v2' | 'v2beta1';
export type DashboardV3Version = 'v3alpha0';

export interface ResolvedDashboardVersions {
  v1: DashboardV1Version;
  v2: DashboardV2Version;
  /**
   * v3 is not served unless the backend advertises v3alpha0 AND the
   * dashboardRules feature toggle is on. Clients must handle absence.
   */
  v3?: DashboardV3Version;
}

const DASHBOARD_API_GROUP = 'dashboard.grafana.app';
const BETA_V1: DashboardV1Version = 'v1beta1';
const BETA_V2: DashboardV2Version = 'v2beta1';
const V3_ALPHA0: DashboardV3Version = 'v3alpha0';

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

  /**
   * Returns the v3 version string if available, otherwise undefined.
   * v3alpha0 is only advertised when the backend serves it AND the
   * dashboardRules feature toggle is enabled. Callers must handle absence.
   */
  getV3(): DashboardV3Version | undefined {
    if (!this.resolved) {
      debugLog('getV3() called before resolve() — returning undefined');
      return undefined;
    }
    return this.resolved.v3;
  }

  /** True when the backend advertises v3alpha0 and dashboardRules toggle is on. */
  isV3Available(): boolean {
    return this.getV3() !== undefined;
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

    const serverSupportsV3 = availableVersions.has(V3_ALPHA0);
    const v3: DashboardV3Version | undefined =
      serverSupportsV3 && config.featureToggles.dashboardRules ? V3_ALPHA0 : undefined;

    debugLog(
      `Version negotiation: v1=${v1}, v2=${v2}, v3=${v3 ?? 'unavailable'}, preferred=${preferred ?? 'none'} (available: ${Array.from(availableVersions).join(', ')})`
    );

    return v3 ? { v1, v2, v3 } : { v1, v2 };
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
