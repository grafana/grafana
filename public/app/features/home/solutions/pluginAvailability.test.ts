import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocalPlugin } from 'app/features/plugins/admin/types';

import { fetchInstalledPlugins } from '../Recommendations/pluginRecommendations';

import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';

jest.mock('../Recommendations/pluginRecommendations', () => ({
  fetchInstalledPlugins: jest.fn(),
}));

const fetchInstalledPluginsMock = jest.mocked(fetchInstalledPlugins);

function plugin(id: string, enabled: boolean): LocalPlugin {
  return { id, enabled } as LocalPlugin;
}

beforeEach(() => {
  fetchInstalledPluginsMock.mockReset();
  jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('pluginAvailability', () => {
  it('classifies enabled apps as ready for setup', async () => {
    fetchInstalledPluginsMock.mockResolvedValue([plugin('enabled-app', true)]);

    await expect(pluginAvailability()).resolves.toEqual(new Map([['enabled-app', { state: 'setup' }]]));
  });

  it('carries the scoped enable permission for disabled apps', async () => {
    const disabled = plugin('disabled-app', false);
    fetchInstalledPluginsMock.mockResolvedValue([disabled]);
    jest.mocked(contextSrv.hasPermissionInMetadata).mockImplementation((_action, candidate) => candidate === disabled);

    await expect(pluginAvailability()).resolves.toEqual(
      new Map([['disabled-app', { state: 'enable', canEnable: true }]])
    );
  });

  it('fails closed when the plugin inventory is empty or unavailable', async () => {
    fetchInstalledPluginsMock.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('inventory unavailable'));

    await expect(pluginAvailability()).resolves.toEqual(new Map());
    await expect(pluginAvailability()).resolves.toEqual(new Map());
  });
});

describe('setupGuideEnabled', () => {
  it('only reports an enabled setup-guide app as available', async () => {
    fetchInstalledPluginsMock
      .mockResolvedValueOnce([plugin(SETUPGUIDE_PLUGIN_ID, true)])
      .mockResolvedValueOnce([plugin(SETUPGUIDE_PLUGIN_ID, false)]);

    await expect(setupGuideEnabled()).resolves.toBe(true);
    await expect(setupGuideEnabled()).resolves.toBe(false);
  });
});
