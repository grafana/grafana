import { PluginLoadingStrategy } from '@grafana/data';

import { SystemJS } from '../loader/systemjs';
import * as sandboxRegistry from '../sandbox/sandboxPluginLoaderRegistry';

import { importPluginModule } from './importPluginModule';

jest.mock('../sandbox/sandboxPluginLoaderRegistry', () => ({
  shouldLoadPluginInFrontendSandbox: jest.fn().mockResolvedValue(false),
}));

const baseInfo = {
  path: 'public/plugins/test-plugin/module.js',
  pluginId: 'test-plugin',
  pluginName: 'Test Plugin',
  loadingStrategy: PluginLoadingStrategy.script,
};

describe('importPluginModule integrity registration', () => {
  let addImportMap: jest.SpyInstance;
  let integrity: Record<string, string> | undefined;

  beforeEach(() => {
    integrity = {};
    jest.mocked(sandboxRegistry.shouldLoadPluginInFrontendSandbox).mockResolvedValue(false);
    jest.spyOn(System, 'resolve').mockImplementation((id: string) => new URL(id, window.location.href).href);
    jest.spyOn(System, 'getImportMap').mockImplementation(() => ({ imports: {}, scopes: {}, integrity }));
    addImportMap = jest.spyOn(SystemJS, 'addImportMap').mockImplementation(() => {});
    jest.spyOn(SystemJS, 'import').mockResolvedValue({ plugin: 'loaded' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the module hash for the resolved module path', async () => {
    await importPluginModule({ ...baseInfo, moduleHash: 'sha256-abc' });

    expect(addImportMap).toHaveBeenCalledTimes(1);
    expect(addImportMap).toHaveBeenCalledWith({
      integrity: { 'http://localhost/public/plugins/test-plugin/module.js': 'sha256-abc' },
    });
  });

  it('does not overwrite an existing integrity entry', async () => {
    integrity = { 'http://localhost/public/plugins/test-plugin/module.js': 'sha256-existing' };

    await expect(importPluginModule({ ...baseInfo, moduleHash: 'sha256-abc' })).resolves.toEqual({ plugin: 'loaded' });

    expect(addImportMap).not.toHaveBeenCalled();
  });

  it('does not register anything when there is no module hash', async () => {
    await expect(importPluginModule(baseInfo)).resolves.toEqual({ plugin: 'loaded' });

    expect(addImportMap).not.toHaveBeenCalled();
  });
});
