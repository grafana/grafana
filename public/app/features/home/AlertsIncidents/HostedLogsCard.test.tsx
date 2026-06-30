import { render, screen } from 'test/test-utils';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { fetchHostedLogs, HostedLogsCard } from './HostedLogsCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  getBackendSrv: jest.fn(),
}));

const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);
const mockGetBackendSrv = jest.mocked(getBackendSrv);
const get = jest.fn();

const bytes = (n: number) => formattedValueToString(getValueFormat('decbytes')(n));

function setDataSources(
  list: Array<{ uid: string; isDefault?: boolean; type?: string }> = [{ uid: 'loki', isDefault: true, type: 'loki' }]
) {
  mockGetDataSourceSrv.mockReturnValue({ getList: () => list } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  get.mockReset();
  mockGetBackendSrv.mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);
  setDataSources();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HostedLogsCard', () => {
  it('renders the volume stat, source count and a Healthy pill', async () => {
    // 25_000_000_000 + 25_492_207_104 = 50_492_207_104 bytes (~47 GB).
    get.mockResolvedValueOnce({ data: { result: [{ value: [0, '25000000000'] }, { value: [0, '25492207104'] }] } });
    get.mockResolvedValueOnce({ data: ['svc-a', 'svc-b', 'svc-c'] });

    render(<HostedLogsCard />);

    expect(await screen.findByText(bytes(50492207104))).toBeInTheDocument();
    expect(screen.getByText('ingested · 7d')).toBeInTheDocument();
    expect(screen.getByText('3 sources connected')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText(`${bytes(50492207104)} ingested (7d)`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open explore/i })).toHaveAttribute('href', '/explore');
  });

  it('shows a No recent ingest pill and warning row when nothing was ingested', async () => {
    get.mockResolvedValueOnce({ data: { result: [] } });
    get.mockResolvedValueOnce({ data: ['svc-a'] });

    render(<HostedLogsCard />);

    expect(await screen.findByText('No recent ingest')).toBeInTheDocument();
    expect(screen.getByText('1 source connected')).toBeInTheDocument();
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the volume request fails', async () => {
    get.mockRejectedValueOnce(new Error('boom'));

    render(<HostedLogsCard />);

    expect(await screen.findByText('Could not load logs')).toBeInTheDocument();
  });
});

describe('fetchHostedLogs', () => {
  it('sums per-series bytes and counts label values', async () => {
    get.mockResolvedValueOnce({ data: { result: [{ value: [0, '10'] }, { value: [0, '32'] }] } });
    get.mockResolvedValueOnce({ data: ['a', 'b'] });

    await expect(fetchHostedLogs()).resolves.toEqual({ bytes7d: 42, sources: 2 });
  });

  it('throws when no Loki datasource is configured', async () => {
    setDataSources([]);

    await expect(fetchHostedLogs()).rejects.toThrow('No loki datasource configured');
  });
});
