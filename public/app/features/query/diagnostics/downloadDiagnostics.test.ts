import { saveAs } from 'file-saver';

import { type DataQuery } from '@grafana/schema';

import { downloadDiagnosticsForQueries } from './downloadDiagnostics';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// NOTE: this covers the temporary client-side placeholder. When bundle generation moves to
// POST /api/ds/diagnostics, this test is replaced by one asserting the request/response handling.
describe('downloadDiagnosticsForQueries (placeholder)', () => {
  beforeEach(() => jest.mocked(saveAs).mockClear());

  it('does nothing when there are no visible queries', async () => {
    await downloadDiagnosticsForQueries([{ refId: 'A', hide: true }], '1', '2');

    expect(saveAs).not.toHaveBeenCalled();
  });

  it('saves a PLACEHOLDER bundle containing only the visible queries', async () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', hide: true }];

    await downloadDiagnosticsForQueries(queries, '100', '200');

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [blob, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toMatch(/^diagnostics-\d{8}-\d{6}-PLACEHOLDER\.json$/);

    const parsed = JSON.parse(await (blob as Blob).text());
    expect(parsed.queries).toEqual([{ refId: 'A' }]);
    expect(parsed.from).toBe('100');
    expect(parsed.to).toBe('200');
    expect(parsed._placeholder).toEqual(expect.any(String));
  });
});
