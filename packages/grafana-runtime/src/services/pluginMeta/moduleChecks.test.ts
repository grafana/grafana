import { PluginType } from '@grafana/data';

import {
  hasModuleMetaAgreement,
  isLoadableModule,
  logMetasDisagreementsWithBootData,
  logUnloadableModules,
  PluginMetaSource,
} from './moduleChecks';

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

describe('hasModuleMetaAgreement', () => {
  it.each([
    ['modules match', CDN_MODULE, CDN_MODULE],
    ['both undefined', undefined, undefined],
    ['both empty', '', ''],
  ])('returns true when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasModuleMetaAgreement(metasModule, bootDataModule)).toBe(true);
  });

  it.each([
    ['modules differ (core vs cdn)', CORE_MODULE, CDN_MODULE],
    ['metas has a value and bootdata is undefined', CDN_MODULE, undefined],
    ['metas has a value and bootdata is empty', CDN_MODULE, ''],
    ['metas module is empty and bootdata has a value', '', CDN_MODULE],
    ['metas module is undefined and bootdata has a value', undefined, CDN_MODULE],
  ])('returns false when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasModuleMetaAgreement(metasModule, bootDataModule)).toBe(false);
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

describe('logMetasDisagreementsWithBootData', () => {
  it('logs a single aggregated warning for one disagreement', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { canvas: entryWith(CORE_MODULE) },
      { canvas: entryWith(CDN_MODULE) },
      PluginType.panel,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas module disagreements', {
      pluginType: PluginType.panel,
      count: '1',
      total: '1',
      pluginIds: 'canvas',
    });
  });

  it('aggregates disagreements into a single warning call', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      {
        canvas: entryWith(CORE_MODULE),
        text: entryWith(CDN_MODULE),
        gauge: entryWith(''),
      },
      {
        canvas: entryWith(CDN_MODULE),
        text: entryWith(CDN_MODULE),
        gauge: entryWith(CDN_MODULE),
      },
      PluginType.app,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas module disagreements', {
      pluginType: PluginType.app,
      count: '2',
      total: '3',
      pluginIds: 'canvas,gauge',
    });
  });

  it('does not log when modules match', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { canvas: entryWith(CDN_MODULE) },
      { canvas: entryWith(CDN_MODULE) },
      PluginType.panel,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).not.toHaveBeenCalled();
  });

  it('logs a disagreement when a plugin is present in metas but missing from bootdata', () => {
    // A plugin the metas response advertises to the frontend but that bootdata
    // has no record of is a divergence worth surfacing: it can indicate the
    // frontend exposing plugins the backend does not consider installed.
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { canvas: entryWith(CDN_MODULE) },
      {},
      PluginType.panel,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas module disagreements', {
      pluginType: PluginType.panel,
      count: '1',
      total: '1',
      pluginIds: 'canvas',
    });
  });
});
