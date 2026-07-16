import { saveAs } from 'file-saver';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

const DIAGNOSTICS_ENDPOINT = '/api/ds/diagnostics';

/** Fallback bundle filename, e.g. `diagnostics-20260623-172901.tar.gz` (local time), used when the
 * response carries no Content-Disposition filename. */
function fallbackFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `diagnostics-${stamp}.tar.gz`;
}

/** Extracts the filename from a Content-Disposition header, if present. */
function fileNameFromContentDisposition(header: string | null): string | undefined {
  // Stop at a closing quote or the next parameter (;), so an unquoted filename followed by other
  // Content-Disposition params (e.g. filename*=) doesn't get captured into the name.
  return header?.match(/filename="?([^";]+)"?/i)?.[1];
}

/**
 * Requests a diagnostic bundle for the given panel queries from the backend and downloads it.
 *
 * The bundle is generated server-side by `POST /api/ds/diagnostics`. That endpoint is not available
 * yet (it lands in a separate backend PR); until then this call fails and the drawer surfaces the
 * error. The request/response contract and this download flow are final.
 */
export async function downloadDiagnosticsForQueries(
  queries: DataQuery[],
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<void> {
  const visibleQueries = queries.filter((query) => !query.hide);

  if (visibleQueries.length === 0) {
    return;
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<Blob>({
      url: DIAGNOSTICS_ENDPOINT,
      method: 'POST',
      responseType: 'blob',
      data: { from, to, queries: visibleQueries },
      // Surface failures in the drawer instead of a global toast.
      showErrorAlert: false,
      // Cancelling the drawer aborts the in-flight request.
      abortSignal: signal,
    })
  );

  const filename = fileNameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackFileName();
  saveAs(response.data, filename);
}
