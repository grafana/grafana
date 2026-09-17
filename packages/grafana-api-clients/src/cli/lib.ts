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
