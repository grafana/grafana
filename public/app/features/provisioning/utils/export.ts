import saveAs from 'file-saver';

import {
  API_GROUP,
  API_VERSION,
  type Connection,
  type ConnectionSecure,
  type Repository,
  type SecureValues,
} from 'app/api/clients/provisioning/v0alpha1';

const DEFAULT_API_VERSION = `${API_GROUP}/${API_VERSION}`;

/**
 * Stored secrets come back from the API as name references, never plaintext, so they cannot be
 * exported as-is. Each configured secret becomes a `{ create: <placeholder> }` entry instead, which
 * keeps the manifest a ready-to-fill template.
 */
function toSecurePlaceholders(
  secure?: SecureValues | ConnectionSecure
): Record<string, { create: string }> | undefined {
  if (!secure) {
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
 * Downloads a Repository or Connection as a JSON manifest (apiVersion/kind/metadata/spec[/secure]).
 * Status and annotations are stripped so the file can be applied to another instance as-is.
 *
 * apiVersion/kind are taken from the resource when present and fall back to the client's API
 * group/version and `fallbackKind`, because Kubernetes list responses — which back the admin cards —
 * do not populate per-item TypeMeta.
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
