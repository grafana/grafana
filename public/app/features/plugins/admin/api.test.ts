import { config, getBackendSrv, type MonitoringLogger, setBackendSrv } from '@grafana/runtime';
import { installPluginMeta, uninstallPluginMeta, FlagKeys } from '@grafana/runtime/internal';
import { mockLogger, setTestFlags } from '@grafana/test-utils/unstable';

import { getPluginDetails, getPluginEntitlement, getPluginInsights, installPlugin, uninstallPlugin } from './api';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  installPluginMeta: jest.fn(),
  uninstallPluginMeta: jest.fn(),
}));

const installPluginMetaMock = jest.mocked(installPluginMeta);
const uninstallPluginMetaMock = jest.mocked(uninstallPluginMeta);

describe('api', () => {
  let logger: MonitoringLogger;

  beforeEach(() => {
    jest.resetAllMocks();
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
    logger = mockLogger('grafana/runtime.plugins.meta');
  });

  afterEach(() => {
    setTestFlags({});
    config.pluginAdminExternalManageEnabled = false;
  });

  describe('when plugins.useMTPluginInstall flag is enabled on an externally managed instance', () => {
    beforeEach(() => {
      config.pluginAdminExternalManageEnabled = true;
      setTestFlags({ [FlagKeys.PluginsUseMTPluginInstall]: true });
    });

    describe('installPlugin', () => {
      it('should only call the new api when it succeeds', async () => {
        installPluginMetaMock.mockResolvedValue();

        await installPlugin('myorg-test-panel', '1.5.0');

        expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should fall back to the legacy api and log when the new api fails', async () => {
        installPluginMetaMock.mockRejectedValue(new Error('Network Error'));

        await installPlugin('myorg-test-panel', '1.5.0');

        expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().post).toHaveBeenCalledWith(
          '/api/plugins/myorg-test-panel/install',
          { version: '1.5.0' },
          { showErrorAlert: false }
        );
        expect(logger.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'installPluginMeta: Failed to install plugin, falling back to the legacy API',
            cause: expect.objectContaining({ message: 'Network Error' }),
          }),
          { pluginId: 'myorg-test-panel', pluginVersion: '1.5.0' }
        );
      });

      it('should reject with the legacy api error when both apis fail', async () => {
        installPluginMetaMock.mockRejectedValue(new Error('Network Error'));
        jest.mocked(getBackendSrv().post).mockRejectedValue(new Error('legacy failed'));

        await expect(installPlugin('myorg-test-panel', '1.5.0')).rejects.toThrow('legacy failed');
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(installPlugin('text/secret?x=', '1.5.0')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(installPluginMetaMock).not.toHaveBeenCalled();
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });
    });

    describe('uninstallPlugin', () => {
      it('should only call the new api when it succeeds', async () => {
        uninstallPluginMetaMock.mockResolvedValue();

        await uninstallPlugin('myorg-test-panel');

        expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });

      it('should fall back to the legacy api and log when the new api fails', async () => {
        uninstallPluginMetaMock.mockRejectedValue(new Error('Network Error'));

        await uninstallPlugin('myorg-test-panel');

        expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
        expect(getBackendSrv().post).toHaveBeenCalledWith('/api/plugins/myorg-test-panel/uninstall');
        expect(logger.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'uninstallPluginMeta: Failed to uninstall plugin, falling back to the legacy API',
            cause: expect.objectContaining({ message: 'Network Error' }),
          }),
          { pluginId: 'myorg-test-panel' }
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(uninstallPlugin('text/secret?x=')).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
        expect(getBackendSrv().post).not.toHaveBeenCalled();
      });
    });
  });

  describe('when plugins.useMTPluginInstall flag is enabled but the instance is not externally managed', () => {
    beforeEach(() => {
      config.pluginAdminExternalManageEnabled = false;
      setTestFlags({ [FlagKeys.PluginsUseMTPluginInstall]: true });
    });

    it('should only call the legacy api when installing', async () => {
      await installPlugin('myorg-test-panel', '1.5.0');

      expect(installPluginMetaMock).not.toHaveBeenCalled();
      expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
    });

    it('should only call the legacy api when uninstalling', async () => {
      await uninstallPlugin('myorg-test-panel');

      expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
      expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
    });
  });

  describe('when only plugins.useMTPlugins flag is enabled', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPlugins]: true });
    });

    it('should call both the new and the legacy api when installing', async () => {
      installPluginMetaMock.mockResolvedValue();

      await installPlugin('myorg-test-panel', '1.5.0');

      expect(installPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel', '1.5.0');
      expect(getBackendSrv().post).toHaveBeenCalledWith(
        '/api/plugins/myorg-test-panel/install',
        { version: '1.5.0' },
        { showErrorAlert: false }
      );
    });

    it('should call the legacy api and log when the new api fails to install', async () => {
      installPluginMetaMock.mockRejectedValue(new Error('Network Error'));

      await installPlugin('myorg-test-panel', '1.5.0');

      expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'installPluginMeta: Failed to install plugin' }),
        { pluginId: 'myorg-test-panel', pluginVersion: '1.5.0' }
      );
    });

    it('should call both the new and the legacy api when uninstalling', async () => {
      uninstallPluginMetaMock.mockResolvedValue();

      await uninstallPlugin('myorg-test-panel');

      expect(uninstallPluginMetaMock).toHaveBeenCalledWith('myorg-test-panel');
      expect(getBackendSrv().post).toHaveBeenCalledWith('/api/plugins/myorg-test-panel/uninstall');
    });

    it('should call the legacy api and log when the new api fails to uninstall', async () => {
      uninstallPluginMetaMock.mockRejectedValue(new Error('Network Error'));

      await uninstallPlugin('myorg-test-panel');

      expect(getBackendSrv().post).toHaveBeenCalledTimes(1);
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'uninstallPluginMeta: Failed to uninstall plugin' }),
        { pluginId: 'myorg-test-panel' }
      );
    });
  });

  describe('when no plugins flag is enabled', () => {
    beforeEach(() => {
      setTestFlags({});
    });

    it('should only call the legacy api when installing', async () => {
      await installPlugin('myorg-test-panel', '1.5.0');

      expect(installPluginMetaMock).not.toHaveBeenCalled();
      expect(getBackendSrv().post).toHaveBeenCalledWith(
        '/api/plugins/myorg-test-panel/install',
        { version: '1.5.0' },
        { showErrorAlert: false }
      );
    });

    it('should only call the legacy api when uninstalling', async () => {
      await uninstallPlugin('myorg-test-panel');

      expect(uninstallPluginMetaMock).not.toHaveBeenCalled();
      expect(getBackendSrv().post).toHaveBeenCalledWith('/api/plugins/myorg-test-panel/uninstall');
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
