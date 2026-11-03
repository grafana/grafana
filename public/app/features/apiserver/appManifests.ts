import { useEffect, useState } from 'react';

import { getI18nInstance } from '@grafana/i18n/internal';
import { getBackendSrv } from '@grafana/runtime';

/** A kind that an app manifest declares, with how user interfaces display it (`extensions.ui`). */
export interface AppManifestKind {
  appName: string;
  group: string;
  kind: string;
  plural: string;
  resource: string;
  labelKey?: string;
  /** Path of the page for one resource of the kind; `{name}` stands for the resource name. */
  url?: string;
  icon?: string;
}

interface AppManifestList {
  items?: Array<{
    spec: {
      appName: string;
      group: string;
      preferredVersion?: string;
      versions?: Array<{ name: string; kinds?: AppManifestListKind[] }>;
    };
  }>;
}

interface AppManifestListKind {
  kind: string;
  plural?: string;
  resource?: string;
  extensions?: { ui?: { labelKey?: string; url?: string; icon?: string } };
}

let kinds: AppManifestKind[] = [];
let loading: Promise<AppManifestKind[]> | undefined;

/**
 * Loads the kinds of the app manifests that the router publishes, once. When the router does not
 * serve the manifests, the list stays empty.
 */
export function loadAppManifestKinds(): Promise<AppManifestKind[]> {
  loading ??= Promise.resolve()
    .then(() =>
      getBackendSrv().get<AppManifestList>('/apis/discovery/v1alpha2/manifests', undefined, undefined, {
        showErrorAlert: false,
      })
    )
    .then((list) => (kinds = toAppManifestKinds(list)))
    .catch(() => kinds);
  return loading;
}

/** Returns the kinds loaded so far. */
export function getAppManifestKinds(): AppManifestKind[] {
  return kinds;
}

/** Returns the loaded kinds, and renders again when they finish loading. */
export function useAppManifestKinds(): AppManifestKind[] {
  const [loaded, setLoaded] = useState(kinds);
  useEffect(() => {
    let active = true;
    loadAppManifestKinds().then((result) => active && setLoaded(result));
    return () => {
      active = false;
    };
  }, []);
  return loaded;
}

/**
 * Translates the display name of a kind with its `labelKey`, in the translations of its app. Without
 * a translation, the name is the kind for one resource and the plural for other counts.
 */
export function getAppManifestKindLabel(kind: AppManifestKind, count = 1): string {
  const fallback = count === 1 ? kind.kind : kind.plural;
  if (!kind.labelKey) {
    return fallback;
  }
  return getI18nInstance().t(kind.labelKey, { ns: kind.appName, count, defaultValue: fallback });
}

function toAppManifestKinds(list: AppManifestList): AppManifestKind[] {
  const out: AppManifestKind[] = [];
  const seen = new Set<string>();
  for (const { spec } of list.items ?? []) {
    const versions = [...(spec.versions ?? [])].sort(
      (a, b) => Number(b.name === spec.preferredVersion) - Number(a.name === spec.preferredVersion)
    );
    for (const version of versions) {
      for (const k of version.kinds ?? []) {
        const id = `${spec.group}/${k.kind}`;
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        const plural = k.plural || `${k.kind}s`;
        out.push({
          appName: spec.appName,
          group: spec.group,
          kind: k.kind,
          plural,
          resource: k.resource || plural.toLowerCase(),
          ...k.extensions?.ui,
        });
      }
    }
  }
  return out;
}
