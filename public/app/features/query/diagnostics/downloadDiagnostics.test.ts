import { saveAs } from 'file-saver';
import { of } from 'rxjs';

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

    await downloadDiagnosticsForQueries([{ refId: 'A', hide: true }], '1', '2');

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

    await downloadDiagnosticsForQueries(queries, '100', '200');

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

    await downloadDiagnosticsForQueries([{ refId: 'A' }], '100', '200', undefined, panel, dashboard);

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/ds/diagnostics',
        method: 'POST',
        // panel.json / dashboard.json are bundled server-side from these.
        data: { from: '100', to: '200', queries: [{ refId: 'A' }], panel, dashboard },
      })
    );
  });

  it('falls back to a generated filename when no Content-Disposition is returned', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    setupBackendSrv({ data: blob, headers: new Headers() });

    await downloadDiagnosticsForQueries([{ refId: 'A' }], '1', '2');

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^diagnostics-\d{8}-\d{6}\.tar\.gz$/);
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
