import { of, throwError } from 'rxjs';
import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType, formattedValueToString, getValueFormat } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { fetchHostedMetrics, HostedMetricsCard } from './HostedMetricsCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);
const query = jest.fn();

// Assert against the same formatter the card uses: this pins the card's contract ("short-formatted")
// rather than a brittle literal, so a unit/format change updates both sides together.
const short = (n: number) => formattedValueToString(getValueFormat('short')(n));

// One single-value instant frame per refId, mirroring a Prometheus instant query response.
function makeFrame(refId: string, value: number) {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [value] },
    ],
  });
}

function frames(values: Partial<Record<string, number>>) {
  return Object.entries(values).map(([refId, v]) => makeFrame(refId, v as number));
}

function setDataSources(
  list: Array<{ uid: string; isDefault?: boolean; type?: string }> = [
    { uid: 'prom', isDefault: true, type: 'prometheus' },
  ]
) {
  mockGetDataSourceSrv.mockReturnValue({
    getList: () => list,
    get: async () => ({ query }),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  query.mockReset();
  query.mockReturnValue(of({ data: [] }));
  setDataSources();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HostedMetricsCard', () => {
  it('renders the series stat, ingest sublabel, a Healthy pill and an all-up row', async () => {
    query.mockReturnValue(of({ data: frames({ series: 14874, ingestRate: 969, targetsUp: 11, targetsTotal: 11 }) }));

    render(<HostedMetricsCard />);

    expect(await screen.findByText(short(14874))).toBeInTheDocument();
    expect(screen.getByText('series')).toBeInTheDocument();
    expect(screen.getByText(`${short(969)}/s ingested`)).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('All 11 targets up')).toBeInTheDocument();
    expect(screen.getByText(`Ingesting ${short(969)}/s`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open metrics/i })).toHaveAttribute('href', '/explore');
  });

  it('shows a targets-down pill and a warning row when some targets are down', async () => {
    query.mockReturnValue(of({ data: frames({ series: 14874, ingestRate: 969, targetsUp: 9, targetsTotal: 11 }) }));

    render(<HostedMetricsCard />);

    expect(await screen.findByText('2 targets down')).toBeInTheDocument();
    expect(screen.getByText('9 of 11 targets up')).toBeInTheDocument();
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the query fails, and retry refetches', async () => {
    query.mockReturnValueOnce(throwError(() => new Error('boom')));
    query.mockReturnValueOnce(
      of({ data: frames({ series: 14874, ingestRate: 969, targetsUp: 11, targetsTotal: 11 }) })
    );

    const { user } = render(<HostedMetricsCard />);

    expect(await screen.findByText('Could not load metrics')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(short(14874))).toBeInTheDocument();
  });
});

describe('fetchHostedMetrics', () => {
  it('parses the four scalars from the response frames', async () => {
    query.mockReturnValue(of({ data: frames({ series: 14874, ingestRate: 969, targetsUp: 11, targetsTotal: 11 }) }));

    await expect(fetchHostedMetrics()).resolves.toEqual({
      series: 14874,
      ingestRate: 969,
      targetsUp: 11,
      targetsTotal: 11,
    });
  });

  it('defaults every missing scalar to zero', async () => {
    query.mockReturnValue(of({ data: [] }));

    await expect(fetchHostedMetrics()).resolves.toEqual({ series: 0, ingestRate: 0, targetsUp: 0, targetsTotal: 0 });
  });

  it('throws when no Prometheus datasource is configured', async () => {
    setDataSources([]);

    await expect(fetchHostedMetrics()).rejects.toThrow('No prometheus datasource configured');
  });
});
