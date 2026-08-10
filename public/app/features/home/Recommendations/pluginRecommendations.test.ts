import { type BackendSrv, getBackendSrv } from '@grafana/runtime';

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

it('shares the plugin inventory between concurrent homepage consumers', async () => {
  const overview = fetchInstalledPlugins();
  const recommendations = fetchInstalledPlugins();

  await expect(Promise.all([overview, recommendations])).resolves.toEqual([[], []]);
  expect(get).toHaveBeenCalledTimes(1);
});
