import { AppEvents, type BootData, type GrafanaConfig } from '@grafana/data';

import { GrafanaBootConfig } from './config';
import { setAppEvents } from './services/appEvents';
import { type LegacyFeatureToggleMode } from './utils/legacyFeatureToggles';

describe('GrafanaBootConfig legacy feature toggle handling', () => {
  let warnSpy: jest.SpyInstance;
  let publishSpy: jest.Mock;
  const originalMode = window.__grafanaLegacyFeatureToggleMode;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    publishSpy = jest.fn();
    setAppEvents({ publish: publishSpy, getStream: jest.fn(), newScopedBus: jest.fn() } as never);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    window.__grafanaLegacyFeatureToggleMode = originalMode;
  });

  describe('off', () => {
    it.each([undefined, 'off', 'nonsense'])('does nothing when the mode is %s', (mode) => {
      window.__grafanaLegacyFeatureToggleMode = mode as LegacyFeatureToggleMode | undefined;
      const config = createConfig();

      expect(config.featureToggles.panelTitleSearch).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    beforeEach(() => {
      window.__grafanaLegacyFeatureToggleMode = 'log';
    });

    it('reports reads but leaves the values intact', () => {
      const config = createConfig();

      expect(config.featureToggles.panelTitleSearch).toBe(true);
      expect(config.featureToggles.lokiExperimentalStreaming).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it('says the toggle will stop resolving, rather than that it already has', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;

      expect(warnSpy.mock.calls[0][0]).toContain('will stop resolving');
    });

    it('stays in the console, without raising an alert', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('alert', () => {
    beforeEach(() => {
      window.__grafanaLegacyFeatureToggleMode = 'alert';
    });

    it('raises a warning alert', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;

      expect(publishSpy).toHaveBeenCalledWith({
        type: AppEvents.alertWarning.name,
        payload: [
          'Legacy feature toggle read: "panelTitleSearch"',
          'Use OpenFeature instead, or remove the legacy toggle entirely.',
        ],
      });
    });

    it('leaves the values intact', () => {
      const config = createConfig();

      expect(config.featureToggles.panelTitleSearch).toBe(true);
      expect(config.featureToggles.lokiExperimentalStreaming).toBe(false);
    });

    it('alerts once per toggle, not once per read', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.panelTitleSearch;

      expect(publishSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the app event bus is not wired up yet', () => {
      setAppEvents(undefined as never);
      const config = createConfig();

      expect(() => config.featureToggles.panelTitleSearch).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('block', () => {
    beforeEach(() => {
      window.__grafanaLegacyFeatureToggleMode = 'block';
    });

    it('resolves every toggle to undefined', () => {
      const config = createConfig();

      expect(config.featureToggles.panelTitleSearch).toBeUndefined();
      expect(config.featureToggles.lokiExperimentalStreaming).toBeUndefined();
    });

    it('reports once per toggle, not once per read', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.lokiExperimentalStreaming;

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[0][0]).toContain('"panelTitleSearch"');
    });

    it('says the toggle already resolves to undefined, rather than that it will', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;

      expect(warnSpy.mock.calls[0][0]).toContain('now resolves to undefined');
    });

    it('stays in the console, without raising an alert', () => {
      const config = createConfig();

      void config.featureToggles.panelTitleSearch;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('closes the bootData bypass by sharing one proxy', () => {
      const config = createConfig();

      expect(config.bootData.settings.featureToggles).toBe(config.featureToggles);
      expect(config.bootData.settings.featureToggles.panelTitleSearch).toBeUndefined();
    });
  });
});

function createConfig(): GrafanaBootConfig {
  const settings: GrafanaConfig = {
    ...window.grafanaBootData.settings,
    featureToggles: {
      panelTitleSearch: true,
      lokiExperimentalStreaming: false,
    },
  };
  const bootData: BootData = {
    assets: { dark: '', light: '' },
    navTree: [],
    settings,
    user: { ...window.grafanaBootData.user, theme: 'dark' },
  };

  return new GrafanaBootConfig({ ...settings, bootData });
}
