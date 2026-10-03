import { PluginType } from '@grafana/data';

import { isLoadableModule, logUnloadableModules, PluginMetaSource } from './moduleChecks';

const CDN_MODULE = 'https://plugins-cdn.grafana.com/canvas/1.0.0/module.js';
const CORE_MODULE = 'core:plugin/canvas';

type Entry = { module?: string };
const entryWith = (module: string | undefined): Entry => ({ module });
const getModule = (e: Entry | undefined) => e?.module;

describe('isLoadableModule', () => {
  it.each([
    ['absolute https URL', CDN_MODULE],
    ['absolute http URL', 'http://example.com/module.js'],
    ['core plugin reference', CORE_MODULE],
    ['local plugin path', 'public/plugins/my-plugin/module.js'],
    ['core-bundled plugin path', 'public/app/plugins/panel/timeseries/module.js'],
  ])('accepts %s', (_desc, module) => {
    expect(isLoadableModule(module)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['undefined', undefined],
    ['relative path', 'module.js'],
    ['dotted relative path', './foo/bar.js'],
    ['unknown scheme', 'ftp://example.com/module.js'],
    ['non-plugin public asset', 'public/fonts/some-font.woff2'],
  ])('rejects %s', (_desc, module) => {
    expect(isLoadableModule(module)).toBe(false);
  });
});

describe('logUnloadableModules', () => {
  it('logs a single aggregated error for one unloadable entry', () => {
    const logError = jest.fn();

    logUnloadableModules({ canvas: entryWith('') }, PluginMetaSource.metas, PluginType.panel, getModule, logError);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('PluginMeta: unloadable module paths', undefined, {
      pluginType: PluginType.panel,
      source: PluginMetaSource.metas,
      count: '1',
      total: '1',
      pluginIds: 'canvas',
    });
  });

  it('aggregates unloadable entries into a single log call', () => {
    const logError = jest.fn();

    logUnloadableModules(
      {
        canvas: entryWith(''),
        text: entryWith(CDN_MODULE),
        gauge: entryWith('module.js'),
      },
      PluginMetaSource.bootdata,
      PluginType.app,
      getModule,
      logError
    );

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('PluginMeta: unloadable module paths', undefined, {
      pluginType: PluginType.app,
      source: PluginMetaSource.bootdata,
      count: '2',
      total: '3',
      pluginIds: 'canvas,gauge',
    });
  });

  it('does not call logError when all entries are loadable', () => {
    const logError = jest.fn();

    logUnloadableModules(
      {
        canvas: entryWith(CDN_MODULE),
        text: entryWith(CORE_MODULE),
      },
      PluginMetaSource.metas,
      PluginType.panel,
      getModule,
      logError
    );

    expect(logError).not.toHaveBeenCalled();
  });
});
