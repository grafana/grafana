import { PluginLoadingStrategy, PluginType } from '@grafana/data';

import { PluginAssetFetchError, PluginLoadError } from '../loader/pluginLoadError';
import { SystemJS } from '../loader/systemjs';

import { importPluginModule } from './importPluginModule';
import { type PluginImportInfo } from './types';

const mockLogError = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getLogger: () => ({ logError: mockLogError }),
}));

jest.mock('../sandbox/sandboxPluginLoaderRegistry', () => ({
  shouldLoadPluginInFrontendSandbox: jest.fn().mockResolvedValue(false),
}));

const MODULE_URL = 'https://plugins-cdn.grafana.net/my-panel/1.0.0/public/plugins/my-panel/module.js';

const importInfo: PluginImportInfo = {
  path: MODULE_URL,
  pluginId: 'my-panel',
  pluginType: PluginType.panel,
  pluginName: 'My panel',
  loadingStrategy: PluginLoadingStrategy.script,
  version: '1.0.0',
  moduleHash: 'sha256-abc',
};

describe('importPluginModule', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockLogError.mockClear();
  });

  it('rethrows a PluginLoadError with the same message and the original error as the cause', async () => {
    const cause = new PluginAssetFetchError(MODULE_URL, 404, 'Not Found');
    jest.spyOn(SystemJS, 'import').mockRejectedValue(cause);

    const result = importPluginModule(importInfo);

    await expect(result).rejects.toBeInstanceOf(PluginLoadError);
    await expect(result).rejects.toMatchObject({ message: 'Could not load plugin', cause, errorType: 'http' });
  });

  it('keeps the update hint in the message when the plugin has an update', async () => {
    jest.spyOn(SystemJS, 'import').mockRejectedValue(new Error('boom'));

    const result = importPluginModule({ ...importInfo, hasUpdate: true });

    await expect(result).rejects.toThrow(
      'Could not load plugin. Updating the "My panel" plugin to the latest version may fix the problem.'
    );
  });

  it('logs the existing fields and adds the classification for an http failure', async () => {
    jest.spyOn(SystemJS, 'import').mockRejectedValue(new PluginAssetFetchError(MODULE_URL, 404, 'Not Found'));

    await importPluginModule(importInfo).catch(() => {});

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(expect.any(PluginLoadError), {
      path: MODULE_URL,
      pluginId: 'my-panel',
      pluginVersion: '1.0.0',
      expectedHash: 'sha256-abc',
      loadingStrategy: 'script',
      sriChecksEnabled: 'false',
      originalErrorMessage: `404 Not Found, loading ${MODULE_URL}`,
      originalErrorStack: expect.stringContaining('PluginAssetFetchError'),
      systemJSOriginalErr: `404 Not Found, loading ${MODULE_URL}`,
      pluginType: 'panel',
      errorType: 'http',
      httpStatus: '404',
      httpStatusSource: 'response',
      failedUrl: MODULE_URL,
    });
  });

  it('logs an error thrown by the plugin code as evaluation', async () => {
    jest.spyOn(SystemJS, 'import').mockRejectedValue(new TypeError('x is not a function'));

    await importPluginModule(importInfo).catch(() => {});

    const [, context] = mockLogError.mock.calls[0];
    expect(context).toMatchObject({
      errorType: 'evaluation',
      httpStatusSource: 'none',
      originalErrorMessage: 'x is not a function',
    });
    expect(context).not.toHaveProperty('httpStatus');
    expect(context).not.toHaveProperty('failedUrl');
  });

  it('logs the chunk error type for a chunk load failure', async () => {
    const chunkUrl = MODULE_URL.replace('module.js', '156.js');
    const chunkError = Object.assign(new Error(`Loading chunk 156 failed.\n(error: ${chunkUrl})`), {
      name: 'ChunkLoadError',
      type: 'error',
      request: chunkUrl,
    });
    jest.spyOn(SystemJS, 'import').mockRejectedValue(chunkError);

    await importPluginModule(importInfo).catch(() => {});

    const [, context] = mockLogError.mock.calls[0];
    expect(context).toMatchObject({ errorType: 'chunk-load', chunkErrorType: 'error', failedUrl: chunkUrl });
  });

  it('logs a rejection that is not an Error as unknown', async () => {
    jest.spyOn(SystemJS, 'import').mockRejectedValue('boom');

    await importPluginModule(importInfo).catch(() => {});

    const [, context] = mockLogError.mock.calls[0];
    expect(context).toMatchObject({ errorType: 'unknown', originalErrorMessage: 'boom', originalErrorStack: '' });
  });
});
