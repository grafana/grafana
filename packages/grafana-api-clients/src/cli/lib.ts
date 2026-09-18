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

/** Same endpoint filter as the clients in this package: drop the per-kind search and trash routes. */
export function includeEndpoint(path: string): boolean {
  return !perResourceSearch.test(path);
}

/**
 * processOpenAPISpec strips both `/apis/<group>/<version>` and `/namespaces/{namespace}` from every path,
 * on the assumption that everything is served under the namespaced base URL. Cluster-scoped kinds,
 * version-level routes and discovery are not: their paths are restored to absolute so createBaseQuery
 * leaves them alone (it only prefixes relative paths).
 */
export function restoreClusterPaths(
  processed: OpenAPIV3.Document,
  raw: OpenAPIV3.Document,
  group: string,
  version: string
): OpenAPIV3.Document {
  const prefix = `/apis/${group}/${version}`;
  const namespaced = new Set<string>();
  for (const p of Object.keys(raw.paths ?? {})) {
    if (p.startsWith(`${prefix}/namespaces/{namespace}`)) {
      namespaced.add(p.slice(`${prefix}/namespaces/{namespace}`.length) || '/');
    }
  }
  const paths: OpenAPIV3.PathsObject = {};
  for (const [p, item] of Object.entries(processed.paths)) {
    paths[namespaced.has(p) ? p : prefix + (p === '/' ? '/' : p)] = item;
  }
  return { ...processed, paths };
}
