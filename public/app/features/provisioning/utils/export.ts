import saveAs from 'file-saver';

import { API_GROUP, API_VERSION, type Connection, type Repository } from 'app/api/clients/provisioning/v0alpha1';

const DEFAULT_API_VERSION = `${API_GROUP}/${API_VERSION}`;

/**
 * Builds a `secure` block where every secret present on the resource is replaced with a
 * `{ create: <placeholder> }` entry. Stored secrets are returned by the API as name references
 * (never plaintext), so they cannot be exported as-is; emitting `create` placeholders keeps the
 * manifest a ready-to-fill template that matches the bootstrap format.
 */
function toSecurePlaceholders(secure: unknown): Record<string, { create: string }> | undefined {
  if (!secure || typeof secure !== 'object') {
    return undefined;
  }

  const out: Record<string, { create: string }> = {};
  for (const [key, value] of Object.entries(secure)) {
    if (value == null) {
      continue;
    }
    out[key] = { create: `<replace-with-${key}>` };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Downloads a Repository or Connection as a JSON manifest matching the file-bootstrap format
 * (apiVersion/kind/metadata/spec[/secure]). Status and manager annotations are stripped so the file
 * can be dropped straight into the provisioning manifests directory. Secret values are never
 * exported; each configured secret becomes a `{ create: <placeholder> }` entry to fill in.
 *
 * apiVersion/kind are taken from the resource when present (e.g. a detail GET) and fall back to the
 * client's API group/version and `fallbackKind`, because Kubernetes list responses — which back the
 * admin cards — do not populate per-item TypeMeta.
 */
export function exportResourceAsJson(resource: Repository | Connection, fallbackKind: 'Repository' | 'Connection') {
  const manifest: Record<string, unknown> = {
    apiVersion: resource.apiVersion ?? DEFAULT_API_VERSION,
    kind: resource.kind ?? fallbackKind,
    metadata: {
      name: resource.metadata?.name,
      namespace: resource.metadata?.namespace,
    },
    spec: resource.spec,
  };

  const secure = toSecurePlaceholders(resource.secure);
  if (secure) {
    manifest.secure = secure;
  }

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  saveAs(blob, `${resource.metadata?.name ?? fallbackKind.toLowerCase()}.json`);
}
