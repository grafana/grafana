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
    ['bootdata is undefined', CDN_MODULE, undefined],
    ['bootdata is empty', CDN_MODULE, ''],
    ['both undefined', undefined, undefined],
  ])('returns true when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasModuleMetaAgreement(metasModule, bootDataModule)).toBe(true);
  });

  it.each([
    ['modules differ (core vs cdn)', CORE_MODULE, CDN_MODULE],
    ['metas module is empty, bootdata has value (incident shape)', '', CDN_MODULE],
    ['metas module is undefined, bootdata has value', undefined, CDN_MODULE],
  ])('returns false when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasModuleMetaAgreement(metasModule, bootDataModule)).toBe(false);
  });
});

describe('logUnloadableModules', () => {
  it.each([
    ['empty string', ''],
    ['undefined', undefined],
    ['relative path', 'module.js'],
    ['dotted relative path', './foo/bar.js'],
    ['unknown scheme', 'ftp://example.com/module.js'],
  ])('logs an error when a module is %s', (_desc, module) => {
    const logError = jest.fn();

    logUnloadableModules({ canvas: entryWith(module) }, PluginMetaSource.metas, PluginType.panel, getModule, logError);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('PluginMeta: unloadable module path', undefined, {
      pluginId: 'canvas',
      pluginType: PluginType.panel,
      module: module ?? '',
      source: PluginMetaSource.metas,
    });
  });

  it.each([
    ['https URL', CDN_MODULE],
    ['core plugin reference', CORE_MODULE],
    ['http URL', 'http://example.com/module.js'],
    ['local plugin path', 'public/plugins/my-plugin/module.js'],
    ['core-bundled plugin path', 'public/app/plugins/panel/timeseries/module.js'],
  ])('does not log for loadable module (%s)', (_desc, module) => {
    const logError = jest.fn();

    logUnloadableModules({ canvas: entryWith(module) }, PluginMetaSource.metas, PluginType.panel, getModule, logError);

    expect(logError).not.toHaveBeenCalled();
  });

  it('passes the source through to the logged context', () => {
    const logError = jest.fn();

    logUnloadableModules({ canvas: entryWith('') }, PluginMetaSource.bootdata, PluginType.panel, getModule, logError);

    expect(logError).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ source: PluginMetaSource.bootdata })
    );
  });

  it('passes the pluginType through to the logged context', () => {
    const logError = jest.fn();

    logUnloadableModules({ 'test-app': entryWith('') }, PluginMetaSource.metas, PluginType.app, getModule, logError);

    expect(logError).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ pluginType: PluginType.app })
    );
  });

  it('logs once per unloadable entry across multiple entries', () => {
    const logError = jest.fn();

    logUnloadableModules(
      {
        canvas: entryWith(''),
        text: entryWith(CDN_MODULE),
        gauge: entryWith('module.js'),
      },
      PluginMetaSource.metas,
      PluginType.panel,
      getModule,
      logError
    );

    expect(logError).toHaveBeenCalledTimes(2);
  });
});

describe('logMetasDisagreementsWithBootData', () => {
  it('logs a warning when metas module differs from bootdata module', () => {
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
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas module disagreement', {
      pluginId: 'canvas',
      pluginType: PluginType.panel,
      bootDataModule: CDN_MODULE,
      metasModule: CORE_MODULE,
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

  it('does not log when bootdata has no entry for the plugin', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { canvas: entryWith(CDN_MODULE) },
      {},
      PluginType.panel,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).not.toHaveBeenCalled();
  });

  it('logs disagreement even when the metas module is empty (incident shape)', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { canvas: entryWith('') },
      { canvas: entryWith(CDN_MODULE) },
      PluginType.panel,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ metasModule: '' }));
  });

  it('passes the pluginType through to the logged context', () => {
    const logWarning = jest.fn();

    logMetasDisagreementsWithBootData(
      { 'test-app': entryWith(CORE_MODULE) },
      { 'test-app': entryWith(CDN_MODULE) },
      PluginType.app,
      getModule,
      getModule,
      logWarning
    );

    expect(logWarning).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pluginType: PluginType.app })
    );
  });
});
