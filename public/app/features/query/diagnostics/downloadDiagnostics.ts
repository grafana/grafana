import { saveAs } from 'file-saver';

/** Builds a human-readable bundle filename stem, e.g. `diagnostics-20260623-172901` (local time). */
function diagnosticsFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `diagnostics-${stamp}`;
}

/**
 * Downloads a diagnostic artifact for the given panel queries.
 *
 * TEMPORARY / PLACEHOLDER: real bundle generation (HAR + logs + panel/dashboard JSON) is produced
 * by the backend endpoint `POST /api/ds/diagnostics`, which lands in a separate backend PR. Until
 * then, this generates a small dummy JSON artifact client-side so the panel action + drawer flow is
 * reviewable end-to-end. Replace this body with a POST to the endpoint once the backend is merged.
 */
export async function downloadDiagnosticsForQueries(
  queries: Array<Record<string, unknown>>,
  from: string,
  to: string,
  panel?: unknown,
  dashboard?: unknown
): Promise<void> {
  const visibleQueries = queries.filter((query) => !query.hide);

  if (visibleQueries.length === 0) {
    return;
  }

  const placeholder = {
    _placeholder: 'Dummy diagnostics artifact — backend generation is not wired up yet (see PR).',
    generatedAt: new Date().toISOString(),
    from,
    to,
    queries: visibleQueries,
    panel,
    dashboard,
  };

  const blob = new Blob([JSON.stringify(placeholder, null, 2)], { type: 'application/json' });
  saveAs(blob, `${diagnosticsFileName()}-PLACEHOLDER.json`);
}
