import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { installPluginMeta, uninstallPluginMeta, FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { getPluginDetails, getPluginEntitlement, getPluginInsights, installPlugin, uninstallPlugin } from './api';

jest.mock('@grafana/runtime/internal', () => {
  const actual = jest.requireActual('@grafana/runtime/internal');
  return {
    ...actual,
    installPluginMeta: jest.fn(actual.installPluginMeta),
    uninstallPluginMeta: jest.fn(actual.uninstallPluginMeta),
  };
});

const installPluginMetaMock = jest.mocked(installPluginMeta);
const uninstallPluginMetaMock = jest.mocked(uninstallPluginMeta);
const originalFetch = global.fetch;

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setBackendSrv({
      chunked: jest.fn(),
      delete: jest.fn(),
      fetch: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      request: jest.fn(),
      datasourceRequest: jest.fn(),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
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

    describe('installPlugin', () => {
      it('should only call new api', async () => {
        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
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
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should reject when installPluginMeta fails without calling the legacy api', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

        await expect(installPlugin('myorg-test-panel', '1.5.0')).rejects.toThrow('Network Error');

        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(installPlugin('text/secret?x=', '1.5.0')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });
    });

    describe('uninstallPlugin', () => {
      it('should only call new api', async () => {
        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          'apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/myorg-test-panel',
          { method: 'DELETE' }
        );
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should reject when uninstallPluginMeta fails without calling the legacy api', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

        await expect(uninstallPlugin('myorg-test-panel')).rejects.toThrow('Network Error');

        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(uninstallPlugin('text/secret?x=')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
        expect(getBackendSrv().post).not.toHaveBeenCalled();
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

    describe('installPlugin', () => {
      it('should only call legacy api', async () => {
        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().post).toHaveBeenCalledWith(
          '/api/plugins/myorg-test-panel/install',
          { version: '1.5.0' },
          { showErrorAlert: false }
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(installPlugin('text/secret?x=', '1.5.0')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });
    });

    describe('uninstallPlugin', () => {
      it('should only call legacy api', async () => {
        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().post).toHaveBeenCalledWith('/api/plugins/myorg-test-panel/uninstall');
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(uninstallPlugin('text/secret?x=')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });
    });
  });

  describe('read entry points', () => {
    const invalidId = 'text/secret?x=';
    const invalidIdError = `Invalid plugin ID "${invalidId}"`;

    it('getPluginDetails should reject invalid plugin IDs without making a request', async () => {
      await expect(getPluginDetails(invalidId)).rejects.toThrow(invalidIdError);

      expect(getBackendSrv().get).not.toHaveBeenCalled();
    });

    it('getPluginInsights should reject invalid plugin IDs without making a request', async () => {
      await expect(getPluginInsights(invalidId, '1.0.0')).rejects.toThrow(invalidIdError);

      expect(getBackendSrv().get).not.toHaveBeenCalled();
    });

    it('getPluginInsights should check the plugin ID before the version', async () => {
      await expect(getPluginInsights(invalidId, undefined)).rejects.toThrow(invalidIdError);
    });

    it('getPluginEntitlement should reject invalid plugin IDs without making a request', async () => {
      await expect(getPluginEntitlement(invalidId)).rejects.toThrow(invalidIdError);

      expect(getBackendSrv().get).not.toHaveBeenCalled();
    });
  });
});
