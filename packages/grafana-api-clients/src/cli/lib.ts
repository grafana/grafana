import { type OpenAPIV3 } from 'openapi-types';

const perResourceSearch = /^\/[^/]+\/(search|trash)$/;

/** The group and version a document describes, from its first /apis/<group>/<version>/ path, else the <group>-<version>.json filename. */
export function groupVersion(spec: OpenAPIV3.Document, file: string): { group: string; version: string } {
  for (const p of Object.keys(spec.paths ?? {})) {
    const m = p.match(/^\/apis\/([^/]+)\/([^/]+)\//);
    if (m) {
      return { group: m[1], version: m[2] };
    }
  }
  const m = file.replace(/\.json$/, '').match(/^(.*)-([^-]+)$/);
  if (!m) {
    throw new Error(`${file}: unable to determine group and version`);
  }
  return { group: m[1], version: m[2] };
}

/** Every app plugin serves a settings-only v0alpha1; it is not a kind API and gets no client. Expects a processed spec. */
export function isSettingsOnly(spec: OpenAPIV3.Document): boolean {
  return Object.keys(spec.paths).every((p) => p === '/' || p.startsWith('/app/instance'));
}

/**
 * Whether an endpoint of a processed spec gets a hook. Discovery, the plugin settings API (wrapped by
 * @grafana/runtime's getPluginSettings) and the per-kind search/trash routes are left out, as they are
 * for the clients in this package.
 */
export function includeEndpoint(path: string): boolean {
  return path !== '/' && !path.startsWith('/app/instance') && !perResourceSearch.test(path);
}
