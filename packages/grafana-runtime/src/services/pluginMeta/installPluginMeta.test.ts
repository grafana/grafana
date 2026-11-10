import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { setLogger } from '../logging/registry';

import { assertAppPluginId } from './apps';
import { assertDatasourcePluginId } from './datasources';
import { installPluginMeta } from './installPluginMeta';
import { assertPanelPluginId } from './panels';

jest.mock('../pluginMeta/apps', () => ({
  assertAppPluginId: jest.fn(),
}));

jest.mock('../pluginMeta/datasources', () => ({
  assertDatasourcePluginId: jest.fn(),
}));

jest.mock('../pluginMeta/panels', () => ({
  assertPanelPluginId: jest.fn(),
}));

const originalFetch = global.fetch;
const assertAppPluginIdMock = jest.mocked(assertAppPluginId);
const assertDatasourcePluginIdMock = jest.mocked(assertDatasourcePluginId);
const assertPanelPluginIdMock = jest.mocked(assertPanelPluginId);

beforeEach(() => {
  jest.resetAllMocks();
  setLogger('grafana/runtime.plugins.meta', {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  });
  assertAppPluginIdMock.mockResolvedValue(undefined);
  assertDatasourcePluginIdMock.mockResolvedValue(undefined);
  assertPanelPluginIdMock.mockResolvedValue(undefined);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('when plugins.useMTPlugins flag is enabled', () => {
  beforeAll(() => {
    setTestFlags({ [FlagKeys.PluginsUseMTPlugins]: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('installPluginMeta', () => {
    it('should post correct body, headers and method to the correct url', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await installPluginMeta('myorg-test-panel', '1.5.0');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins', {
        body: JSON.stringify({
          apiVersion: 'plugins.grafana.app/v0alpha1',
          kind: 'Plugin',
          metadata: {
            name: 'myorg-test-panel',
            namespace: 'default',
          },
          spec: {
            id: 'myorg-test-panel',
            version: '1.5.0',
          },
          status: {},
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    });

    it('should throw an error if response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        status: 500,
      });

      await expect(installPluginMeta('myorg-test-panel', '1.5.0')).rejects.toThrow(
        'Failed to install plugin myorg-test-panel 500:Internal Server Error'
      );
    });

    it('should throw an error if fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network Error'));

      await expect(installPluginMeta('myorg-test-panel', '1.5.0')).rejects.toThrow('Network Error');
    });

    it('should reject invalid plugin IDs without making a request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      assertAppPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
      assertDatasourcePluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
      assertPanelPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));

      await expect(installPluginMeta('myorg-test-panel/secret?x=', '1.5.0')).rejects.toThrow('Invalid plugin ID');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});

describe('when plugins.useMTPlugins flag is disabled', () => {
  beforeAll(() => {
    setTestFlags({ [FlagKeys.PluginsUseMTPlugins]: false });
  });

  afterAll(() => {
    setTestFlags({});
  });

  describe('installPluginMeta', () => {
    it('should not call fetch when plugins.useMTPlugins is disabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await installPluginMeta('myorg-test-panel', '1.5.0');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reject invalid plugin IDs without making a request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      assertAppPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
      assertDatasourcePluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));
      assertPanelPluginIdMock.mockRejectedValue(new Error('Invalid plugin ID'));

      await expect(installPluginMeta('myorg-test-panel/secret?x=', '1.5.0')).rejects.toThrow('Invalid plugin ID');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
