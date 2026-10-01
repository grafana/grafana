import { type BackendSrv, getBackendSrv } from '@grafana/runtime';

import { PROBE_TIMEOUT_MS } from '../solutions/probeUtils';

import { fetchInstalledPlugins, resetInstalledPlugins } from './pluginRecommendations';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

beforeEach(() => {
  resetInstalledPlugins();
  get.mockReset();
  get.mockResolvedValue([]);
  jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as BackendSrv);
});

afterEach(() => {
  jest.useRealTimers();
});

it('shares the plugin inventory between concurrent homepage consumers', async () => {
  const overview = fetchInstalledPlugins();
  const recommendations = fetchInstalledPlugins();

  await expect(Promise.all([overview, recommendations])).resolves.toEqual([[], []]);
  expect(get).toHaveBeenCalledTimes(1);
});

it('times out a hung inventory request and retries the next read', async () => {
  jest.useFakeTimers();
  get.mockReset();
  get.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce([]);

  const first = fetchInstalledPlugins();
  const timedOut = expect(first).rejects.toThrow(`Probe timed out after ${PROBE_TIMEOUT_MS}ms`);
  await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

  await timedOut;
  await expect(fetchInstalledPlugins()).resolves.toEqual([]);
  expect(get).toHaveBeenCalledTimes(2);
});
