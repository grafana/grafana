import { assertPluginId } from './assertPluginId';
import { assertAppPluginId } from './pluginMeta/apps';
import { assertDatasourcePluginId } from './pluginMeta/datasources';
import { assertPanelPluginId } from './pluginMeta/panels';

jest.mock('./pluginMeta/apps', () => ({
  assertAppPluginId: jest.fn(),
}));

jest.mock('./pluginMeta/datasources', () => ({
  assertDatasourcePluginId: jest.fn(),
}));

jest.mock('./pluginMeta/panels', () => ({
  assertPanelPluginId: jest.fn(),
}));

const assertAppPluginIdMock = jest.mocked(assertAppPluginId);
const assertDatasourcePluginIdMock = jest.mocked(assertDatasourcePluginId);
const assertPanelPluginIdMock = jest.mocked(assertPanelPluginId);

describe('assertPluginId', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    assertAppPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
    assertDatasourcePluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
    assertPanelPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
  });

  it.each(['grafana-exploretraces-app', 'grafana-testdata-datasource', 'grafana-clock-panel'])(
    'should accept plugin IDs matching the naming convention without checking metadata: %s',
    async (pluginId) => {
      const result = await assertPluginId(pluginId);

      expect(result).toBeUndefined();
      expect(assertAppPluginIdMock).not.toHaveBeenCalled();
      expect(assertDatasourcePluginIdMock).not.toHaveBeenCalled();
      expect(assertPanelPluginIdMock).not.toHaveBeenCalled();
    }
  );

  it('should accept known app plugin IDs outside the naming convention', async () => {
    assertAppPluginIdMock.mockResolvedValue(undefined);

    const result = await assertPluginId('legacyapp');

    expect(result).toBeUndefined();
    expect(assertAppPluginIdMock).toHaveBeenCalledWith('legacyapp');
  });

  it('should accept known datasource plugin IDs outside the naming convention', async () => {
    assertDatasourcePluginIdMock.mockResolvedValue(undefined);

    const result = await assertPluginId('prometheus');

    expect(result).toBeUndefined();
    expect(assertDatasourcePluginIdMock).toHaveBeenCalledWith('prometheus');
  });

  it('should accept known panel plugin IDs outside the naming convention', async () => {
    assertPanelPluginIdMock.mockResolvedValue(undefined);

    const result = await assertPluginId('text');

    expect(result).toBeUndefined();
    expect(assertPanelPluginIdMock).toHaveBeenCalledWith('text');
  });

  it.each(['unknown', '', 'text/secret?x=', 'text\\secret', 'text%2fsecret', 'text\n'])(
    'should reject invalid plugin IDs: %s',
    async (pluginId) => {
      await expect(assertPluginId(pluginId)).rejects.toThrow(`Invalid plugin ID "${pluginId}"`);
    }
  );

  it('should reject an omitted plugin ID', async () => {
    await expect(assertPluginId()).rejects.toThrow(`Invalid plugin ID ""`);
  });
});
