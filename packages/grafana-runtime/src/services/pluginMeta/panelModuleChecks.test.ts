import { type PanelPluginMeta, PluginType } from '@grafana/data';

import {
  hasPanelModuleMetaAgreement,
  logPanelMetasDisagreementsWithBootData,
  normalizePanelModulePath,
} from './panelModuleChecks';

const CDN_MODULE = 'https://plugins-cdn.grafana.com/canvas/1.0.0/module.js';
const CORE_MODULE = 'core:plugin/canvas';
const RAW_DECOUPLED_CORE_MODULE = 'public/app/plugins/panel/timeseries/module.js';
const PUBLIC_PATH = 'https://cdn.example.com/';
const PREFIXED_DECOUPLED_CORE_MODULE = `${PUBLIC_PATH}${RAW_DECOUPLED_CORE_MODULE}`;

const panelWith = (module: string | undefined): PanelPluginMeta =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ({ module }) as PanelPluginMeta;

describe('normalizePanelModulePath', () => {
  it('returns undefined when input is undefined', () => {
    expect(normalizePanelModulePath(undefined)).toBeUndefined();
  });

  it('returns empty string when input is empty', () => {
    expect(normalizePanelModulePath('')).toBe('');
  });

  it('returns input unchanged when publicPath is not set', () => {
    expect(normalizePanelModulePath(RAW_DECOUPLED_CORE_MODULE)).toBe(RAW_DECOUPLED_CORE_MODULE);
  });

  describe('when publicPath is set', () => {
    beforeEach(() => {
      window.__grafana_public_path__ = PUBLIC_PATH;
    });

    afterEach(() => {
      window.__grafana_public_path__ = '';
    });

    it('strips a matching publicPath prefix from the module string', () => {
      expect(normalizePanelModulePath(PREFIXED_DECOUPLED_CORE_MODULE)).toBe(RAW_DECOUPLED_CORE_MODULE);
    });

    it('adds a trailing slash to publicPath before matching', () => {
      window.__grafana_public_path__ = 'https://cdn.example.com';
      expect(normalizePanelModulePath(PREFIXED_DECOUPLED_CORE_MODULE)).toBe(RAW_DECOUPLED_CORE_MODULE);
    });

    it('returns input unchanged when module does not start with publicPath', () => {
      expect(normalizePanelModulePath(CDN_MODULE)).toBe(CDN_MODULE);
    });
  });
});

describe('hasPanelModuleMetaAgreement', () => {
  it.each([
    ['modules match', CDN_MODULE, CDN_MODULE],
    ['both undefined', undefined, undefined],
    ['both empty', '', ''],
  ])('returns true when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasPanelModuleMetaAgreement(metasModule, bootDataModule)).toBe(true);
  });

  it.each([
    ['modules differ (core vs cdn)', CORE_MODULE, CDN_MODULE],
    ['metas has a value and bootdata is undefined', CDN_MODULE, undefined],
    ['metas has a value and bootdata is empty', CDN_MODULE, ''],
    ['metas module is empty and bootdata has a value', '', CDN_MODULE],
    ['metas module is undefined and bootdata has a value', undefined, CDN_MODULE],
  ])('returns false when %s', (_desc, metasModule, bootDataModule) => {
    expect(hasPanelModuleMetaAgreement(metasModule, bootDataModule)).toBe(false);
  });

  describe('when publicPath is set (decoupled core plugin)', () => {
    beforeEach(() => {
      window.__grafana_public_path__ = PUBLIC_PATH;
    });

    afterEach(() => {
      window.__grafana_public_path__ = '';
    });

    it('returns true when metas has publicPath-prefixed module and bootdata has raw module', () => {
      expect(hasPanelModuleMetaAgreement(PREFIXED_DECOUPLED_CORE_MODULE, RAW_DECOUPLED_CORE_MODULE)).toBe(true);
    });

    it('returns false when normalized modules still differ', () => {
      expect(hasPanelModuleMetaAgreement(PREFIXED_DECOUPLED_CORE_MODULE, CORE_MODULE)).toBe(false);
    });
  });
});

describe('logPanelMetasDisagreementsWithBootData', () => {
  it('logs a single aggregated warning for one disagreement', () => {
    const logWarning = jest.fn();

    logPanelMetasDisagreementsWithBootData(
      { canvas: panelWith(CORE_MODULE) },
      { canvas: panelWith(CDN_MODULE) },
      logWarning
    );

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas panel module disagreements', {
      pluginType: PluginType.panel,
      count: '1',
      total: '1',
      pluginIds: 'canvas',
    });
  });

  it('aggregates disagreements into a single warning call', () => {
    const logWarning = jest.fn();

    logPanelMetasDisagreementsWithBootData(
      {
        canvas: panelWith(CORE_MODULE),
        text: panelWith(CDN_MODULE),
        gauge: panelWith(''),
      },
      {
        canvas: panelWith(CDN_MODULE),
        text: panelWith(CDN_MODULE),
        gauge: panelWith(CDN_MODULE),
      },
      logWarning
    );

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas panel module disagreements', {
      pluginType: PluginType.panel,
      count: '2',
      total: '3',
      pluginIds: 'canvas,gauge',
    });
  });

  it('does not log when modules match', () => {
    const logWarning = jest.fn();

    logPanelMetasDisagreementsWithBootData(
      { canvas: panelWith(CDN_MODULE) },
      { canvas: panelWith(CDN_MODULE) },
      logWarning
    );

    expect(logWarning).not.toHaveBeenCalled();
  });

  it('logs a disagreement when a panel is present in metas but missing from bootdata', () => {
    // A panel the metas response advertises to the frontend but that bootdata
    // has no record of is a divergence worth surfacing: it can indicate the
    // frontend exposing panels the backend does not consider installed.
    const logWarning = jest.fn();

    logPanelMetasDisagreementsWithBootData({ canvas: panelWith(CDN_MODULE) }, {}, logWarning);

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('PluginMeta: bootdata/metas panel module disagreements', {
      pluginType: PluginType.panel,
      count: '1',
      total: '1',
      pluginIds: 'canvas',
    });
  });

  describe('when publicPath is set (decoupled core plugin)', () => {
    beforeEach(() => {
      window.__grafana_public_path__ = PUBLIC_PATH;
    });

    afterEach(() => {
      window.__grafana_public_path__ = '';
    });

    it('does not log when a decoupled core panel has matching normalized modules', () => {
      const logWarning = jest.fn();

      logPanelMetasDisagreementsWithBootData(
        { timeseries: panelWith(PREFIXED_DECOUPLED_CORE_MODULE) },
        { timeseries: panelWith(RAW_DECOUPLED_CORE_MODULE) },
        logWarning
      );

      expect(logWarning).not.toHaveBeenCalled();
    });
  });
});
