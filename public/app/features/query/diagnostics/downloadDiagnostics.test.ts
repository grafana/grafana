import { saveAs } from 'file-saver';
import { of } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { downloadDiagnosticsForQueries } from './downloadDiagnostics';

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

  it('falls back to a generated filename when no Content-Disposition is returned', async () => {
    const blob = new Blob(['bundle'], { type: 'application/gzip' });
    setupBackendSrv({ data: blob, headers: new Headers() });

    await downloadDiagnosticsForQueries([{ refId: 'A' }], '1', '2');

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^diagnostics-\d{8}-\d{6}\.tar\.gz$/);
  });
});
