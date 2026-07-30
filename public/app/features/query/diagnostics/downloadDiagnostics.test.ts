import { saveAs } from 'file-saver';
import { of, throwError } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import {
  downloadDashboardDiagnostics,
  downloadDiagnosticsForQueries,
  getDashboardDiagnosticsStatus,
  startDashboardDiagnostics,
} from './downloadDiagnostics';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('@grafana/runtime', () => ({ getBackendSrv: jest.fn() }));

function setupBackendSrv(response: unknown) {
  const fetch = jest.fn().mockReturnValue(of(response));
  jest.mocked(getBackendSrv).mockReturnValue({ fetch } as unknown as ReturnType<typeof getBackendSrv>);
  return fetch;
}

describe('downloadDiagnosticsForQueries', () => {
  beforeEach(() => {
    jest.mocked(saveAs).mockClear();
  });

  it('does nothing when there are no visible queries', async () => {
    const fetch = setupBackendSrv({});

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A', hide: true }], from: '1', to: '2' });

    expect(fetch).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('POSTs the visible queries and saves the returned bundle', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    const fetch = setupBackendSrv({
      data: blob,
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="diagnostics-20260101-000000.tar.gz"' }),
    });
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];

    await downloadDiagnosticsForQueries({ queries, from: '100', to: '200' });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/diagnostics',
        method: 'POST',
        responseType: 'blob',
        // Only the visible query is forwarded.
        data: { from: '100', to: '200', queries: [{ refId: 'A' }] },
      })
    );
    expect(saveAs).toHaveBeenCalledWith(blob, 'diagnostics-20260101-000000.tar.gz');
  });

  it('includes the panel and dashboard save models in the POST body when provided', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    const fetch = setupBackendSrv({ data: blob, headers: new Headers() });
    const panel = { id: 1, type: 'timeseries' };
    const dashboard = { uid: 'd1', panels: [panel] };

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '100', to: '200', panel, dashboard });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/diagnostics',
        method: 'POST',
        // panel.json / dashboard.json are bundled server-side from these.
        data: { from: '100', to: '200', queries: [{ refId: 'A' }], panel, dashboard },
      })
    );
  });

  it('includes the captured frontend panel data in the POST body when provided', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    const fetch = setupBackendSrv({ data: blob, headers: new Headers() });
    const panelData = { version: 1, panelKey: 'panel-1', pluginId: 'timeseries', frames: [] };

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '100', to: '200', panelData });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/diagnostics',
        method: 'POST',
        // paneldata.json is bundled server-side from this, and is what querydata.json gets diffed against.
        data: { from: '100', to: '200', queries: [{ refId: 'A' }], panelData },
      })
    );
  });

  it('falls back to a generated filename when no Content-Disposition is returned', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    setupBackendSrv({ data: blob, headers: new Headers() });

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '1', to: '2' });

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^diagnostics-\d{8}-\d{6}\.tar\.gz$/);
  });
});

describe('partial-bundle reporting', () => {
  const args = { queries: [{ refId: 'A' }] as DataQuery[], from: '1', to: '2' };

  it('reports the artifacts the size limit dropped', async () => {
    setupBackendSrv({ data: new Blob(['x']), headers: new Headers({ 'X-Diagnostics-Dropped-Artifacts': '2' }) });

    await expect(downloadDiagnosticsForQueries(args)).resolves.toEqual({ droppedArtifacts: 2 });
  });

  it('reports a complete bundle when the header is absent', async () => {
    setupBackendSrv({ data: new Blob(['x']), headers: new Headers() });

    await expect(downloadDiagnosticsForQueries(args)).resolves.toEqual({ droppedArtifacts: 0 });
  });

  // A header we can't parse must not become a warning: the bundle downloaded either way, and a spurious
  // "incomplete" notice would send a support engineer looking for artifacts that are all present.
  it.each([['not-a-number'], ['0'], ['-1'], ['']])('treats %p as a complete bundle', async (value) => {
    setupBackendSrv({ data: new Blob(['x']), headers: new Headers({ 'X-Diagnostics-Dropped-Artifacts': value }) });

    await expect(downloadDiagnosticsForQueries(args)).resolves.toEqual({ droppedArtifacts: 0 });
  });
});

describe('dashboard diagnostics', () => {
  beforeEach(() => {
    jest.mocked(saveAs).mockClear();
  });

  it('startDashboardDiagnostics POSTs the panels and returns the job uid', async () => {
    const fetch = setupBackendSrv({ data: { uid: 'job-123', state: 'pending' } });
    const panels = [{ id: 1, title: 'A', from: '1', to: '2', queries: [{ refId: 'A' }] }];

    const uid = await startDashboardDiagnostics(panels);

    expect(uid).toBe('job-123');
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/dashboard-diagnostics',
        method: 'POST',
        responseType: 'json',
        data: { dashboard: undefined, panels },
      })
    );
  });

  it('startDashboardDiagnostics throws when no uid is returned', async () => {
    setupBackendSrv({ data: {} });
    await expect(startDashboardDiagnostics([{ id: 1, title: 'A', from: '1', to: '2', queries: [] }])).rejects.toThrow(
      'Diagnostics job was not created'
    );
  });

  it('getDashboardDiagnosticsStatus GETs the job status', async () => {
    const fetch = setupBackendSrv({ data: { uid: 'job-123', state: 'complete', panelsTotal: 2, panelsDone: 2 } });

    const status = await getDashboardDiagnosticsStatus('job-123');

    expect(status.state).toBe('complete');
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/ds/dashboard-diagnostics/job-123', method: 'GET' })
    );
  });

  it('downloadDashboardDiagnostics downloads the completed bundle', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    const fetch = setupBackendSrv({ data: blob, headers: new Headers() });

    await downloadDashboardDiagnostics('job-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/dashboard-diagnostics/job-123/download',
        method: 'GET',
        responseType: 'blob',
      })
    );
    expect(saveAs).toHaveBeenCalledTimes(1);
    const [, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^dashboard-diagnostics-\d{8}-\d{6}\.tar\.gz$/);
  });
});

// The Content-Disposition parser (fileNameFromContentDisposition) isn't exported, so it's exercised
// through its only caller-visible surface: the filename saveAs is called with. `undefined` matches
// (no name parsed -> generated fallback) are asserted separately below.
describe('Content-Disposition filename parsing', () => {
  beforeEach(() => {
    jest.mocked(saveAs).mockClear();
  });

  it.each([
    ['a quoted filename', 'attachment; filename="bundle.tar.gz"', 'bundle.tar.gz'],
    ['an unquoted filename', 'attachment; filename=bundle.tar.gz', 'bundle.tar.gz'],
    [
      'an unquoted filename followed by an RFC5987 filename* param (stops at the ";")',
      "attachment; filename=bundle.tar.gz; filename*=UTF-8''b%C3%BCndle.tar.gz",
      'bundle.tar.gz',
    ],
    ['a case-insensitive header key', 'attachment; FILENAME=Bundle.TAR.gz', 'Bundle.TAR.gz'],
  ])('uses the parsed name for %s', async (_name, header, expected) => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    setupBackendSrv({ data: blob, headers: new Headers({ 'Content-Disposition': header }) });

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '1', to: '2' });

    expect(saveAs).toHaveBeenCalledWith(blob, expected);
  });

  it.each([
    // A bare RFC5987 filename* is not decoded here (the parser matches "filename=" literally), so it
    // falls through to the generated fallback rather than yielding a mangled name.
    ['a bare RFC5987 filename*', "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.tar.gz"],
    ['a header with no filename parameter', 'attachment'],
    ['an empty header value', ''],
  ])('falls back to a generated name for %s', async (_name, header) => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    setupBackendSrv({ data: blob, headers: new Headers({ 'Content-Disposition': header }) });

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '1', to: '2' });

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^diagnostics-\d{8}-\d{6}\.tar\.gz$/);
  });
});

describe('abort signal handling', () => {
  beforeEach(() => {
    jest.mocked(saveAs).mockClear();
  });

  it('forwards the abort signal to the POST fetch when downloading panel diagnostics', async () => {
    const fetch = setupBackendSrv({ data: new Blob(['x']), headers: new Headers() });
    const { signal } = new AbortController();

    await downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '1', to: '2', signal });

    // The drawer's AbortController.signal must reach getBackendSrv so cancel/unmount can abort the
    // in-flight request; showErrorAlert stays false so the drawer surfaces failures itself.
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: signal, showErrorAlert: false }));
  });

  it('forwards the abort signal through the whole dashboard job lifecycle', async () => {
    const { signal } = new AbortController();

    const startFetch = setupBackendSrv({ data: { uid: 'job-1' } });
    await startDashboardDiagnostics(
      [{ id: 1, title: 'A', from: '1', to: '2', queries: [{ refId: 'A' }] }],
      undefined,
      signal
    );
    expect(startFetch).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: signal }));

    const statusFetch = setupBackendSrv({ data: { uid: 'job-1', state: 'complete', panelsTotal: 1, panelsDone: 1 } });
    await getDashboardDiagnosticsStatus('job-1', signal);
    expect(statusFetch).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: signal }));

    const downloadFetch = setupBackendSrv({ data: new Blob(['x']), headers: new Headers() });
    await downloadDashboardDiagnostics('job-1', signal);
    expect(downloadFetch).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: signal }));
  });

  it('rejects and saves nothing when the fetch errors (e.g. an aborted request)', async () => {
    // An aborted in-flight request surfaces as a rejected observable; the flow must reject cleanly and
    // not attempt to save a file.
    const err = new DOMException('The user aborted a request.', 'AbortError');
    const fetch = jest.fn().mockReturnValue(throwError(() => err));
    jest.mocked(getBackendSrv).mockReturnValue({ fetch } as unknown as ReturnType<typeof getBackendSrv>);

    await expect(downloadDiagnosticsForQueries({ queries: [{ refId: 'A' }], from: '1', to: '2' })).rejects.toBe(err);
    expect(saveAs).not.toHaveBeenCalled();
  });
});
