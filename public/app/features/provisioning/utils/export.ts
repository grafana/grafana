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
 * Stored secrets come back from the API as name references, never plaintext, so each configured
 * secret becomes a `{ create: <placeholder> }` entry to fill in. `skipKeys` drops secrets the
 * server mints for itself, where a filled-in placeholder would be rejected rather than accepted.
 */
function toSecurePlaceholders(
  secure: SecureValues | ConnectionSecure | undefined,
  skipKeys: string[] = []
): Record<string, { create: string }> | undefined {
  if (!secure) {
    return undefined;
  }

  const out: Record<string, { create: string }> = {};
  for (const [key, value] of Object.entries(secure)) {
    if (value == null || skipKeys.includes(key)) {
      continue;
    }
    out[key] = { create: `<replace-with-${key}>` };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function secretsToSkip(resource: Repository | Connection, kind: string): string[] {
  // A connection's token is always derived server-side — a JWT minted from the private key for
  // GitHub App connections, the exchanged token for OAuth — and is rejected if it is anything else.
  if (kind === 'Connection') {
    return ['token'];
  }

  // A connection-backed repository has its token minted server-side too, and creating a writable
  // repository that declares both a connection and a token is rejected as mutually exclusive.
  const spec = resource.spec;
  return spec && 'connection' in spec && spec.connection?.name ? ['token'] : [];
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
  const kind = resource.kind ?? fallbackKind;
  const manifest: Record<string, unknown> = {
    apiVersion: resource.apiVersion ?? DEFAULT_API_VERSION,
    kind,
    metadata: {
      name: resource.metadata?.name,
      namespace: resource.metadata?.namespace,
    },
    spec: resource.spec,
  };

  const secure = toSecurePlaceholders(resource.secure, secretsToSkip(resource, kind));
  if (secure) {
    manifest.secure = secure;
  }

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  saveAs(blob, `${resource.metadata?.name ?? fallbackKind.toLowerCase()}.json`);
}
