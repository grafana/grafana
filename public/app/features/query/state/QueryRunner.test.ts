import { NEVER, Observable } from 'rxjs';

import { type DataSourceApi, getDefaultTimeRange, type PanelData, type QueryRunnerOptions } from '@grafana/data';

import { QueryRunner } from './QueryRunner';

const mockRunRequest = jest.fn();
const mockGetDatasource = jest.fn();

jest.mock('./runRequest', () => ({
  runRequest: (...args: unknown[]) => mockRunRequest(...args),
}));

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    get: (...args: unknown[]) => mockGetDatasource(...args),
  }),
}));

jest.mock('./PanelQueryRunner', () => ({
  getNextRequestId: () => 'Q1',
}));

const ds = { getRef: () => ({ uid: 'prom', type: 'prometheus' }), interval: undefined } as unknown as DataSourceApi;

const options: QueryRunnerOptions = {
  datasource: { uid: 'prom', type: 'prometheus' },
  queries: [{ refId: 'A' }],
  timezone: 'utc',
  timeRange: getDefaultTimeRange(),
  maxDataPoints: 60,
  minInterval: null,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('QueryRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunRequest.mockReturnValue(NEVER);
  });

  it('never starts the request when destroyed during the datasource lookup', async () => {
    const lookup = deferred<DataSourceApi>();
    mockGetDatasource.mockReturnValue(lookup.promise);
    const runner = new QueryRunner();

    runner.run(options);
    runner.destroy();
    lookup.resolve(ds);
    await flush();

    expect(mockRunRequest).not.toHaveBeenCalled();
  });

  it('never starts the request when cancelled during the datasource lookup', async () => {
    const lookup = deferred<DataSourceApi>();
    mockGetDatasource.mockReturnValue(lookup.promise);
    const runner = new QueryRunner();

    runner.run(options);
    runner.cancel();
    lookup.resolve(ds);
    await flush();

    expect(mockRunRequest).not.toHaveBeenCalled();
  });

  it('a newer run supersedes a lookup still in flight', async () => {
    const stale = deferred<DataSourceApi>();
    mockGetDatasource.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(ds);
    const runner = new QueryRunner();

    runner.run(options);
    runner.run(options);
    await flush();
    stale.resolve(ds);
    await flush();

    expect(mockRunRequest).toHaveBeenCalledTimes(1);
  });

  it('runs the request once the datasource resolves', async () => {
    mockGetDatasource.mockResolvedValue(ds);
    const runner = new QueryRunner();

    runner.run(options);
    await flush();

    expect(mockRunRequest).toHaveBeenCalledWith(
      ds,
      expect.objectContaining({ targets: [expect.objectContaining({ refId: 'A' })] })
    );
  });

  it('destroy tears down a request already in flight', async () => {
    const teardown = jest.fn();
    mockRunRequest.mockReturnValue(new Observable<PanelData>(() => teardown));
    mockGetDatasource.mockResolvedValue(ds);
    const runner = new QueryRunner();

    runner.run(options);
    await flush();
    runner.destroy();

    expect(teardown).toHaveBeenCalled();
  });
});
