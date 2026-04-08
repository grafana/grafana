import { getBackendSrv } from '@grafana/runtime';

import { getAPIBaseURL } from '../../../../utils/utils';

export const FOLDER_API_GROUP = 'folder.grafana.app' as const;

export type FolderAPIVersion = 'v1' | 'v1beta1';

const FALLBACK_VERSION: FolderAPIVersion = 'v1beta1';

interface K8sAPIGroupVersion {
  groupVersion: string;
  version: string;
}

interface K8sAPIGroup {
  name: string;
  versions: K8sAPIGroupVersion[];
  preferredVersion?: { groupVersion: string; version: string };
}

class FolderAPIVersionResolver {
  private resolved: FolderAPIVersion | null = null;
  private resolving: Promise<FolderAPIVersion> | null = null;

  /**
   * Resolves the folder API version from GET /apis/folder.grafana.app/ (cached).
   * On failure, returns v1beta1 without caching so the next call retries discovery.
   */
  async resolve(): Promise<FolderAPIVersion> {
    if (this.resolved) {
      return this.resolved;
    }

    if (!this.resolving) {
      this.resolving = this.discover()
        .then((version) => {
          this.resolved = version;
          return version;
        })
        .catch(() => FALLBACK_VERSION)
        .finally(() => {
          this.resolving = null;
        });
    }

    return this.resolving;
  }

  private async discover(): Promise<FolderAPIVersion> {
    const group = await getBackendSrv().get<K8sAPIGroup>(`/apis/${FOLDER_API_GROUP}/`, undefined, undefined, {
      showErrorAlert: false,
    });
    const availableVersions = new Set(group.versions.map((v) => v.version));
    const preferred = group.preferredVersion?.version;

    if (preferred === 'v1' || preferred === 'v1beta1') {
      return preferred;
    }
    if (availableVersions.has('v1')) {
      return 'v1';
    }
    return FALLBACK_VERSION;
  }

  /** @internal Testing only */
  reset(): void {
    this.resolved = null;
    this.resolving = null;
  }

  /** @internal Testing only */
  set(version: FolderAPIVersion): void {
    this.resolved = version;
  }
}

export const folderAPIVersionResolver = new FolderAPIVersionResolver();

export async function getFolderAPIBaseURL(): Promise<string> {
  const version = await folderAPIVersionResolver.resolve();
  return getAPIBaseURL(FOLDER_API_GROUP, version);
}
