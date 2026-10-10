import { type PanelPluginMeta, PluginType } from '@grafana/data';

import { hasPanelModuleMetaAgreement, logPanelMetasDisagreementsWithBootData } from './panelModuleChecks';

const panelWith = (module: string | undefined): PanelPluginMeta =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ({ module }) as PanelPluginMeta;

describe('hasPanelModuleMetaAgreement', () => {
  describe('trivial equality', () => {
    it.each([
      ['identical core references', 'core:plugin/canvas'],
      ['identical bootdata paths', 'public/app/plugins/panel/timeseries/module.js'],
      ['both undefined', undefined],
      ['both empty strings', ''],
    ])('agrees on %s', (_desc, module) => {
      expect(hasPanelModuleMetaAgreement(module, module)).toBe(true);
    });
  });

  describe('cross-source equivalence for decoupled core panels', () => {
    it('agrees when Cloud metas serves the same panel as bootdata', () => {
      const CLOUD_TIMESERIES =
        'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/panel/timeseries/module.js';
      const BOOT_TIMESERIES = 'public/app/plugins/panel/timeseries/module.js';
      expect(hasPanelModuleMetaAgreement(CLOUD_TIMESERIES, BOOT_TIMESERIES)).toBe(true);
    });
  });

  describe('value drift between defined modules', () => {
    const CLOUD_TIMESERIES =
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/panel/timeseries/module.js';
    const CDN_CANVAS = 'https://plugins-cdn.grafana.com/canvas/1.0.0/module.js';
    const CORE_CANVAS = 'core:plugin/canvas';
    const BOOT_STAT = 'public/app/plugins/panel/stat/module.js';

    it.each([
      ['a core reference and an external CDN URL for the same plugin', CORE_CANVAS, CDN_CANVAS],
      ['a decoupled core panel and an unrelated core reference', CLOUD_TIMESERIES, CORE_CANVAS],
      ['a decoupled core panel and a different plugin path', CLOUD_TIMESERIES, BOOT_STAT],
    ])('disagrees when metas and bootdata resolve to %s', (_desc, metas, boot) => {
      expect(hasPanelModuleMetaAgreement(metas, boot)).toBe(false);
    });
  });

  describe('presence mismatch (one side is defined, the other is not)', () => {
    const SOME_MODULE = 'https://plugins-cdn.grafana.com/canvas/1.0.0/module.js';

    it.each([
      ['metas defined, bootdata undefined', SOME_MODULE, undefined],
      ['metas defined, bootdata empty', SOME_MODULE, ''],
    ])('disagrees when %s', (_desc, metas, boot) => {
      expect(hasPanelModuleMetaAgreement(metas, boot)).toBe(false);
    });
  });
});

describe('logPanelMetasDisagreementsWithBootData', () => {
  const MESSAGE = 'PluginMeta: bootdata/metas panel module disagreements';
  const CDN_CANVAS = 'https://plugins-cdn.grafana.com/canvas/1.0.0/module.js';
  const CORE_CANVAS = 'core:plugin/canvas';

  describe('when there is a value disagreement', () => {
    it('logs a single aggregated warning for one disagreeing panel', () => {
      const logWarning = jest.fn();

      logPanelMetasDisagreementsWithBootData(
        { canvas: panelWith(CORE_CANVAS) },
        { canvas: panelWith(CDN_CANVAS) },
        logWarning
      );

      expect(logWarning).toHaveBeenCalledTimes(1);
      expect(logWarning).toHaveBeenCalledWith(MESSAGE, {
        pluginType: PluginType.panel,
        count: '1',
        total: '1',
        pluginIds: 'canvas',
      });
    });

    it('aggregates multiple disagreements into a single warning call', () => {
      const CDN_TEXT = 'https://plugins-cdn.grafana.com/text/1.0.0/module.js';
      const CDN_GAUGE = 'https://plugins-cdn.grafana.com/gauge/1.0.0/module.js';
      const logWarning = jest.fn();

      // canvas: core vs cdn -> disagreement.
      // text:   cdn vs cdn (same) -> agreement.
      // gauge:  empty vs cdn -> disagreement.
      logPanelMetasDisagreementsWithBootData(
        {
          canvas: panelWith(CORE_CANVAS),
          text: panelWith(CDN_TEXT),
          gauge: panelWith(''),
        },
        {
          canvas: panelWith(CDN_CANVAS),
          text: panelWith(CDN_TEXT),
          gauge: panelWith(CDN_GAUGE),
        },
        logWarning
      );

      expect(logWarning).toHaveBeenCalledTimes(1);
      expect(logWarning).toHaveBeenCalledWith(MESSAGE, {
        pluginType: PluginType.panel,
        count: '2',
        total: '3',
        pluginIds: 'canvas,gauge',
      });
    });
  });

  describe('when there is no disagreement', () => {
    it('does not log when all modules match', () => {
      const logWarning = jest.fn();

      logPanelMetasDisagreementsWithBootData(
        { canvas: panelWith(CDN_CANVAS) },
        { canvas: panelWith(CDN_CANVAS) },
        logWarning
      );

      expect(logWarning).not.toHaveBeenCalled();
    });

    it('does not log when a decoupled core panel on Cloud matches its bootdata entry', () => {
      const CLOUD_TIMESERIES =
        'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/panel/timeseries/module.js';
      const BOOT_TIMESERIES = 'public/app/plugins/panel/timeseries/module.js';
      const logWarning = jest.fn();

      // Metas: fully-qualified CDN URL produced by prependPublicPathToCorePlugins.
      // Bootdata: raw `public/app/plugins/...` path.
      // Normalization strips both to `app/plugins/panel/timeseries/module.js`.
      logPanelMetasDisagreementsWithBootData(
        { timeseries: panelWith(CLOUD_TIMESERIES) },
        { timeseries: panelWith(BOOT_TIMESERIES) },
        logWarning
      );

      expect(logWarning).not.toHaveBeenCalled();
    });
  });

  describe('when a panel is missing from bootdata', () => {
    it('logs a disagreement (frontend advertises a panel the backend does not know about)', () => {
      const logWarning = jest.fn();

      logPanelMetasDisagreementsWithBootData({ canvas: panelWith(CDN_CANVAS) }, {}, logWarning);

      expect(logWarning).toHaveBeenCalledTimes(1);
      expect(logWarning).toHaveBeenCalledWith(MESSAGE, {
        pluginType: PluginType.panel,
        count: '1',
        total: '1',
        pluginIds: 'canvas',
      });
    });
  });
});
