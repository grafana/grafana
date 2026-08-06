import { saveAs } from 'file-saver';
import { lastValueFrom } from 'rxjs';

import { t } from '@grafana/i18n';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { type PanelDataPayload } from './capturePanelData';

const DIAGNOSTICS_ENDPOINT = '/api/ds/diagnostics';
const DASHBOARD_DIAGNOSTICS_ENDPOINT = '/api/ds/dashboard-diagnostics';

/** Fallback bundle filename, e.g. `diagnostics-20260623-172901.tar.gz` (local time), used when the
 * response carries no Content-Disposition filename. */
function fallbackFileName(prefix = 'diagnostics'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}.tar.gz`;
}

/** Extracts the filename from a Content-Disposition header, if present. */
function fileNameFromContentDisposition(header: string | null): string | undefined {
  // Stop at a closing quote or the next parameter (;), so an unquoted filename followed by other
  // Content-Disposition params (e.g. filename*=) doesn't get captured into the name.
  return header?.match(/filename="?([^";]+)"?/i)?.[1];
}

/** The backend's own error message, however the failed response's body arrived: already-parsed JSON
 * for a json-typed fetch, or a Blob for a blob-typed one. The archive-download endpoints always
 * request responseType: 'blob' (they're downloading a file on success), so on failure the JSON error
 * body arrives unparsed too -- see backendSrv's parseResponseBody, which honors the requested
 * responseType regardless of what the response actually contains. */
async function errorBodyMessage(data: unknown): Promise<string | undefined> {
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return typeof parsed?.message === 'string' ? parsed.message : undefined;
    } catch {
      return undefined;
    }
  }
  if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }
  return undefined;
}

/** One human-readable message for any diagnostics request failure, regardless of which endpoint it
 * came from or why: the backend's own message when the response body has one, falling back to the
 * HTTP status line, then to the error's own message. One path for every cause rather than one per
 * endpoint -- a size-limit truncation is never a failure (see Build/BuildDashboard), so nothing here
 * needs to special-case it. */
export async function diagnosticsErrorMessage(error: Error): Promise<string> {
  if (isFetchError(error)) {
    const bodyMessage = await errorBodyMessage(error.data);
    if (bodyMessage) {
      return bodyMessage;
    }
    const parts = [error.status, error.statusText].filter(Boolean);
    return parts.length ? parts.join(' ') : t('dashboard.diagnostics.request-failed', 'Request failed');
  }
  return error.message || t('dashboard.diagnostics.error-title', 'Failed to generate diagnostics');
}

/**
 * One panel diagnostics request.
 */
export interface DiagnosticsRequest {
  queries: DataQuery[];
  /** Epoch ms as a string, matching what the endpoint expects. */
  from: string;
  to: string;
  /** Cancelling the drawer aborts the in-flight request. */
  signal?: AbortSignal;
  /** Panel and dashboard save models, bundled as panel.json / dashboard.json (the backend includes
   * them verbatim); omitted keys simply aren't sent. */
  panel?: unknown;
  dashboard?: unknown;
  /** Frames the frontend was holding for this panel, bundled as paneldata.json. Unlike the save models
   * above this is data rather than a definition, so nothing has to be re-run to read it. */
  panelData?: PanelDataPayload;
}

/**
 * Requests a diagnostic bundle for the given panel queries from the backend and downloads it.
 *
 * The bundle is generated server-side by `POST /api/ds/diagnostics`. That endpoint is not available
 * yet (it lands in a separate backend PR); until then this call fails and the drawer surfaces the
 * error. The request/response contract and this download flow are final.
 */
export async function downloadDiagnosticsForQueries({
  queries,
  from,
  to,
  signal,
  panel,
  dashboard,
  panelData,
}: DiagnosticsRequest): Promise<void> {
  const visibleQueries = queries.filter((query) => !query.hide);

  if (visibleQueries.length === 0) {
    return;
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<Blob>({
      url: DIAGNOSTICS_ENDPOINT,
      method: 'POST',
      responseType: 'blob',
      data: { from, to, queries: visibleQueries, panel, dashboard, panelData },
      // Surface failures in the drawer instead of a global toast.
      showErrorAlert: false,
      // Cancelling the drawer aborts the in-flight request.
      abortSignal: signal,
    })
  );

  const filename = fileNameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackFileName();
  saveAs(response.data, filename);
}

/** One panel's diagnostics input for a whole-dashboard request: its resolved queries and time range
 * (template variables applied by the caller). The dashboard's own JSON, sent alongside the panel
 * list in {@link startDashboardDiagnostics}, is what supplies the panel JSON for the bundle. */
export interface DashboardDiagnosticsPanel {
  id: number;
  title: string;
  from: string;
  to: string;
  queries: DataQuery[];
}

/** State of an async dashboard-diagnostics generation job, as reported by the status endpoint. */
export interface DashboardDiagnosticsStatus {
  uid: string;
  state: 'pending' | 'complete' | 'error';
  panelsTotal: number;
  panelsDone: number;
  error?: string;
}

/**
 * Starts an asynchronous whole-dashboard diagnostics generation and returns the job UID.
 *
 * Whole-dashboard generation can be slow (it re-runs every panel's queries with capture active), so
 * the backend runs it in the background: this POST returns a job UID immediately, the caller polls
 * {@link getDashboardDiagnosticsStatus}, then downloads via {@link downloadDashboardDiagnostics}.
 * The endpoint lands in a separate backend PR; until then this fails and the drawer surfaces it.
 */
export async function startDashboardDiagnostics(
  panels: DashboardDiagnosticsPanel[],
  dashboard?: unknown,
  signal?: AbortSignal
): Promise<string> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<{ uid: string }>({
      url: DASHBOARD_DIAGNOSTICS_ENDPOINT,
      method: 'POST',
      responseType: 'json',
      data: { dashboard, panels },
      showErrorAlert: false,
      abortSignal: signal,
    })
  );
  const uid = response.data?.uid;
  if (!uid) {
    throw new Error(t('dashboard.diagnostics.job-not-created', 'Diagnostics job was not created'));
  }
  return uid;
}

/** Fetches the current state/progress of a dashboard-diagnostics job. */
export async function getDashboardDiagnosticsStatus(
  uid: string,
  signal?: AbortSignal
): Promise<DashboardDiagnosticsStatus> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DashboardDiagnosticsStatus>({
      url: `${DASHBOARD_DIAGNOSTICS_ENDPOINT}/${encodeURIComponent(uid)}`,
      method: 'GET',
      responseType: 'json',
      showErrorAlert: false,
      abortSignal: signal,
    })
  );
  return response.data;
}

/** Downloads the completed bundle for a dashboard-diagnostics job. */
export async function downloadDashboardDiagnostics(uid: string, signal?: AbortSignal): Promise<void> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<Blob>({
      url: `${DASHBOARD_DIAGNOSTICS_ENDPOINT}/${encodeURIComponent(uid)}/download`,
      method: 'GET',
      responseType: 'blob',
      showErrorAlert: false,
      abortSignal: signal,
    })
  );
  const filename =
    fileNameFromContentDisposition(response.headers.get('Content-Disposition')) ??
    fallbackFileName('dashboard-diagnostics');
  saveAs(response.data, filename);
}
