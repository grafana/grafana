import { PanelPlugin, PanelPluginMeta, PluginType } from '@grafana/data';
import { getPanelPluginMeta } from '@grafana/runtime/internal';

import { clearPanelPluginCache, importPanelPlugin } from './importPanelPlugin';
import { pluginImporter } from './importer/pluginImporter';

jest.mock('./importer/pluginImporter', () => ({
  pluginImporter: {
    importPanel: jest.fn(),
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  getPanelPluginMeta: jest.fn(),
}));

const pluginImporterMock = jest.mocked(pluginImporter);
const getPanelPluginMetaMock = jest.mocked(getPanelPluginMeta);

function createPanelPluginMeta(overrides: Partial<PanelPluginMeta> = {}): PanelPluginMeta {
  return {
    id: 'test-panel',
    type: PluginType.panel,
    name: 'Test Panel',
    sort: 0,
    module: 'core:plugin/test-panel',
    baseUrl: '',
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { small: '', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
    ...overrides,
  } as PanelPluginMeta;
}

describe('importPanelPlugin', () => {
  let mockPlugin = new PanelPlugin(null);
  beforeEach(() => {
    clearPanelPluginCache();
    jest.clearAllMocks();
    getPanelPluginMetaMock.mockResolvedValue(createPanelPluginMeta());
    pluginImporterMock.importPanel.mockResolvedValue(mockPlugin);
  });

  it('should return cached promise if plugin is already loaded', async () => {
    const firstCall = importPanelPlugin('test-panel');
    const secondCall = importPanelPlugin('test-panel');

    expect(firstCall).toStrictEqual(secondCall);

    const firstCallResult = await firstCall;
    const secondCallResult = await secondCall;

    expect(firstCallResult).toBe(secondCallResult);
    expect(firstCallResult).toBe(mockPlugin);
    expect(pluginImporterMock.importPanel).toHaveBeenCalledTimes(1);
    expect(getPanelPluginMetaMock).toHaveBeenCalledTimes(1);
  });

  it('should reject with error if plugin meta is not found', async () => {
    getPanelPluginMetaMock.mockResolvedValue(null);
    await expect(importPanelPlugin('non-existent-plugin')).rejects.toThrow(
      new Error(`Plugin non-existent-plugin not found`)
    );
  });

  it('should not cache id when plugin meta is not found for transient errors', async () => {
    getPanelPluginMetaMock.mockResolvedValueOnce(null).mockResolvedValue(createPanelPluginMeta());

    await expect(importPanelPlugin('test-panel')).rejects.toThrow(new Error(`Plugin test-panel not found`));
    const secondCallResult = await importPanelPlugin('test-panel');

    expect(secondCallResult).toBe(mockPlugin);
  });

  it('should cache under both id and meta.type when they differ', async () => {
    const result = await importPanelPlugin('test-panel');
    expect(result).toBe(mockPlugin);

    // Should be cached under both id and meta.type
    const cachedById = importPanelPlugin('test-panel');
    // meta.type is PluginType.panel by default, which differs from 'test-panel'
    const cachedByType = importPanelPlugin(PluginType.panel);

    expect(cachedById).toStrictEqual(cachedByType);

    const cachedByIdResult = await cachedById;
    const cachedByTypeResult = await cachedByType;

    expect(cachedByIdResult).toBe(cachedByTypeResult);
    expect(cachedByIdResult).toBe(mockPlugin);
    expect(pluginImporterMock.importPanel).toHaveBeenCalledTimes(1);
    expect(getPanelPluginMetaMock).toHaveBeenCalledTimes(1);
  });
});
