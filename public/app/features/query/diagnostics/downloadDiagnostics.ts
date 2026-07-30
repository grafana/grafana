import { saveAs } from 'file-saver';
import { lastValueFrom } from 'rxjs';

import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
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

/** Names how many artifacts the backend's bundle size limit dropped. Absent means the bundle is
 * complete; the names of the dropped artifacts are in the bundle's own bundle-limit.txt. */
const DROPPED_ARTIFACTS_HEADER = 'X-Diagnostics-Dropped-Artifacts';

/** How many artifacts the size limit dropped, or 0 when the bundle is complete. A malformed or absent
 * header reads as complete: the bundle downloaded either way, and inventing a warning from a header we
 * could not parse would be worse than staying quiet. */
function droppedArtifactsFrom(headers: Headers): number {
  const parsed = Number(headers.get(DROPPED_ARTIFACTS_HEADER));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Extracts the filename from a Content-Disposition header, if present. */
function fileNameFromContentDisposition(header: string | null): string | undefined {
  // Stop at a closing quote or the next parameter (;), so an unquoted filename followed by other
  // Content-Disposition params (e.g. filename*=) doesn't get captured into the name.
  return header?.match(/filename="?([^";]+)"?/i)?.[1];
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

/** What a completed download can tell the caller about the bundle it just saved. */
export interface DiagnosticsDownloadResult {
  /** Artifacts the backend's size limit dropped; 0 when the bundle is complete. */
  droppedArtifacts: number;
}

/**
 * Requests a diagnostic bundle for the given panel queries from the backend and downloads it.
 *
 * The bundle is generated server-side by `POST /api/ds/diagnostics`. That endpoint is not available
 * yet (it lands in a separate backend PR); until then this call fails and the drawer surfaces the
 * error. The request/response contract and this download flow are final.
 *
 * A bundle the size limit trimmed is still a bundle worth having, so that arrives as a result rather
 * than an error: the response body is the archive itself, so the backend reports it in a header.
 */
export async function downloadDiagnosticsForQueries({
  queries,
  from,
  to,
  signal,
  panel,
  dashboard,
  panelData,
}: DiagnosticsRequest): Promise<DiagnosticsDownloadResult> {
  const visibleQueries = queries.filter((query) => !query.hide);

  if (visibleQueries.length === 0) {
    return { droppedArtifacts: 0 };
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
  return { droppedArtifacts: droppedArtifactsFrom(response.headers) };
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
  /** A bundle that generated but is incomplete -- currently only the size limit dropping artifacts.
   * Distinct from error, which means there is no bundle to download at all. */
  warning?: string;
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
