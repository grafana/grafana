import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Ephemeral in-memory hand-off store for locally generated dashboards.
 *
 * The wizard generates a `DashboardV2Spec` client-side, stashes it here under a
 * fresh key, and navigates to `/dashboard/new?fromGenerator=<key>`. The dashboard
 * scene page manager reads the key from the URL, pulls the spec out, and hands it
 * to the same scene machinery that handles a saved dashboard — but with `uid = ''`
 * and `canSave = true`, so the user lands on an unsaved dashboard they can edit
 * and save.
 *
 * Design notes:
 * - Module-level Map (not sessionStorage) so we skip JSON serialisation of very
 *   large dashboards and can't be polluted by unrelated tabs. Losing the spec on
 *   a hard reload is fine — the user regenerates.
 * - Every read consumes the entry. That way we never re-apply a stale spec if
 *   the user navigates back to `/dashboard/new` for a genuinely blank dashboard.
 * - We cap the store size so a misbehaving caller can't leak specs into memory
 *   forever.
 */
const MAX_ENTRIES = 4;

interface Entry {
  spec: DashboardV2Spec;
  createdAt: number;
}

const store = new Map<string, Entry>();

/**
 * Stashes a generated spec and returns the key you'd embed in
 * `/dashboard/new?fromGenerator=<key>`. Purges the oldest entry when the cap is
 * reached so we degrade gracefully instead of unbounded growth.
 */
export function putGeneratedDashboard(spec: DashboardV2Spec): string {
  if (store.size >= MAX_ENTRIES) {
    const oldest = pickOldestKey();
    if (oldest) {
      store.delete(oldest);
    }
  }
  const key = generateKey();
  store.set(key, { spec, createdAt: Date.now() });
  return key;
}

/**
 * Consumes and returns the spec for the given key. Returns `null` when the key
 * is unknown (unrecognised URL, already consumed, or generator flow bypassed).
 */
export function takeGeneratedDashboard(key: string): DashboardV2Spec | null {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }
  store.delete(key);
  return entry.spec;
}

/** Test-only helper — the wizard never calls this. */
export function clearGeneratedDashboards(): void {
  store.clear();
}

function pickOldestKey(): string | null {
  let oldestKey: string | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  for (const [key, entry] of store.entries()) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }
  return oldestKey;
}

/**
 * Produces a short random key. We only need enough entropy to make collisions
 * impossible in practice within a session; this is not a secret.
 */
function generateKey(): string {
  const bytes = new Uint8Array(9);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
