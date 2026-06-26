import { of, throwError } from 'rxjs';
import { render, screen } from 'test/test-utils';

import { createDataFrame, FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { sloApi, type Slo } from 'app/features/alerting/unified/api/sloApi';

import { fetchSloOverview, getSloDatasourceUids, SlosCard } from './SlosCard';

jest.mock('app/features/alerting/unified/api/sloApi', () => ({
  sloApi: {
    endpoints: {
      getSlos: {
        useQuery: jest.fn(),
      },
    },
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const mockUseGetSlosQuery = jest.mocked(sloApi.endpoints.getSlos.useQuery);
const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);
const refetch = jest.fn();

const query = jest.fn();
const queryPromA = jest.fn();
const queryPromB = jest.fn();

function slo(overrides: Partial<Slo> = {}): Slo {
  return {
    uuid: 'slo-1',
    objectives: [{ value: 0.99, window: '30d' }],
    ...overrides,
  };
}

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

function setSloApiResult(slos: Slo[]) {
  mockUseGetSlosQuery.mockReturnValue({
    data: { slos },
    isLoading: false,
    error: undefined,
    refetch,
  } as unknown as ReturnType<typeof sloApi.endpoints.getSlos.useQuery>);
}

function setDataSources(
  list: Array<{ uid: string; isDefault?: boolean; type?: string }> = [
    { uid: 'prom', isDefault: true, type: 'prometheus' },
  ],
  queriesByUid: Record<string, jest.Mock> = { prom: query }
) {
  mockGetDataSourceSrv.mockReturnValue({
    getList: () => list,
    get: async (uid: string) => ({ query: queriesByUid[uid] ?? query }),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  refetch.mockReset();
  query.mockReset();
  queryPromA.mockReset();
  queryPromB.mockReset();
  query.mockReturnValue(of({ data: [] }));
  queryPromA.mockReturnValue(of({ data: [] }));
  queryPromB.mockReturnValue(of({ data: [] }));
  setSloApiResult([]);
  setDataSources();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SlosCard', () => {
  it('renders all SLO overview stats in one card', async () => {
    setSloApiResult([slo({ uuid: 'slo-1' }), slo({ uuid: 'slo-2' })]);
    query.mockReturnValue(of({ data: frames({ aboveTarget1d: 1, recording: 2, sliSeries: 15 }) }));

    render(<SlosCard />);

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('SLOs defined')).toBeInTheDocument();
    expect(screen.getByText('1 below target')).toBeInTheDocument();
    expect(screen.getByText('1 above target (1 day)')).toBeInTheDocument();
    expect(screen.getByText('2 SLOs recording')).toBeInTheDocument();
    expect(screen.getByText('15 recorded SLI series')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open slos/i })).toHaveAttribute('href', '/a/grafana-slo-app/manage-slos');
  });

  it('shows a Healthy pill when every SLO is above target', async () => {
    setSloApiResult([slo({ uuid: 'slo-1' }), slo({ uuid: 'slo-2' })]);
    query.mockReturnValue(of({ data: frames({ aboveTarget1d: 2, recording: 2, sliSeries: 20 }) }));

    render(<SlosCard />);

    expect(await screen.findByText('Healthy')).toBeInTheDocument();
    expect(screen.queryByText(/below target/)).not.toBeInTheDocument();
  });

  it('shows the empty state when no SLOs are defined', async () => {
    setSloApiResult([]);

    render(<SlosCard />);

    expect(await screen.findByText('No SLOs defined.')).toBeInTheDocument();
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByText('SLOs defined')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the SLO API request fails', async () => {
    mockUseGetSlosQuery.mockReturnValue({
      isLoading: false,
      error: new Error('boom'),
      refetch,
    } as unknown as ReturnType<typeof sloApi.endpoints.getSlos.useQuery>);

    const { user } = render(<SlosCard />);

    expect(await screen.findByText('Could not load SLOs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows a retryable error when metric queries fail', async () => {
    setSloApiResult([slo()]);
    query.mockReturnValue(throwError(() => new Error('boom')));

    render(<SlosCard />);

    expect(await screen.findByText('Could not load SLOs')).toBeInTheDocument();
  });
});

describe('fetchSloOverview', () => {
  it('counts API-defined SLOs and parses metric-backed overview counts', async () => {
    query.mockReturnValue(of({ data: frames({ aboveTarget1d: 2, recording: 3, sliSeries: 42 }) }));

    await expect(
      fetchSloOverview([slo({ uuid: 'slo-1' }), slo({ uuid: 'slo-2' }), slo({ uuid: 'slo-3' })])
    ).resolves.toEqual({
      defined: 3,
      aboveTarget1d: 2,
      recording: 3,
      sliSeries: 42,
    });
  });

  it('sums metric-backed counts across SLO destination datasources', async () => {
    setDataSources(
      [
        { uid: 'prom-a', type: 'prometheus' },
        { uid: 'prom-b', type: 'prometheus' },
      ],
      { 'prom-a': queryPromA, 'prom-b': queryPromB }
    );
    queryPromA.mockReturnValue(of({ data: frames({ aboveTarget1d: 2, recording: 3, sliSeries: 40 }) }));
    queryPromB.mockReturnValue(of({ data: frames({ aboveTarget1d: 4, recording: 5, sliSeries: 60 }) }));

    await expect(
      fetchSloOverview([
        slo({ uuid: 'slo-1', destinationDatasource: { uid: 'prom-a' } }),
        slo({ uuid: 'slo-2', destinationDatasource: { uid: 'prom-b' } }),
      ])
    ).resolves.toEqual({
      defined: 2,
      aboveTarget1d: 6,
      recording: 8,
      sliSeries: 100,
    });
  });

  it('defaults missing metric scalars to zero', async () => {
    query.mockReturnValue(of({ data: [] }));

    await expect(fetchSloOverview([slo()])).resolves.toEqual({
      defined: 1,
      aboveTarget1d: 0,
      recording: 0,
      sliSeries: 0,
    });
  });

  it('does not query metrics for an empty SLO list', async () => {
    await expect(fetchSloOverview([])).resolves.toEqual({
      defined: 0,
      aboveTarget1d: 0,
      recording: 0,
      sliSeries: 0,
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('getSloDatasourceUids', () => {
  it('uses explicit destination datasource UIDs and falls back for missing ones', () => {
    expect(
      getSloDatasourceUids([
        slo({ uuid: 'slo-1', destinationDatasource: { uid: 'prom-a' } }),
        slo({ uuid: 'slo-2' }),
        slo({ uuid: 'slo-3', destinationDatasource: { uid: 'prom-a' } }),
      ])
    ).toEqual(['prom-a', 'prom']);
  });

  it('throws when fallback is needed but no Prometheus datasource is configured', () => {
    setDataSources([]);

    expect(() => getSloDatasourceUids([slo()])).toThrow('No prometheus datasource configured');
  });
});
