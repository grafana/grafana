import { AppEvents, type BootData, type GrafanaConfig } from '@grafana/data';

import { GrafanaBootConfig } from './config';
import { setAppEvents } from './services/appEvents';

describe('GrafanaBootConfig', () => {
  let warnSpy: jest.SpyInstance;
  let publishSpy: jest.Mock;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    publishSpy = jest.fn();
    setAppEvents({ publish: publishSpy, getStream: jest.fn(), newScopedBus: jest.fn() } as never);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('when disableLegacyFeatureToggles is off', () => {
    it('reads pass through untouched, with no warning and no toast', () => {
      const config = createConfig({ disableLegacyFeatureToggles: false });

      expect(config.featureToggles.panelTitleSearch).toBe(true);
      expect(config.featureToggles.lokiExperimentalStreaming).toBe(false);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('is off when the backend omits the field entirely', () => {
      const config = createConfig({});

      expect(config.disableLegacyFeatureToggles).toBe(false);
      expect(config.featureToggles.panelTitleSearch).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('when disableLegacyFeatureToggles is on', () => {
    it('resolves every toggle to undefined', () => {
      const config = createConfig({ disableLegacyFeatureToggles: true });

      expect(config.featureToggles.panelTitleSearch).toBeUndefined();
      // Reads false in the underlying map too, so this proves it is blanked rather than passed through
      expect(config.featureToggles.lokiExperimentalStreaming).toBeUndefined();
    });

    it('warns once per toggle, naming the toggle', () => {
      const config = createConfig({ disableLegacyFeatureToggles: true });

      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.lokiExperimentalStreaming;

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[0][0]).toContain('"panelTitleSearch"');
      expect(warnSpy.mock.calls[1][0]).toContain('"lokiExperimentalStreaming"');
    });

    it('publishes a toast on every read, not just the first', () => {
      const config = createConfig({ disableLegacyFeatureToggles: true });

      void config.featureToggles.panelTitleSearch;
      void config.featureToggles.panelTitleSearch;

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(publishSpy).toHaveBeenLastCalledWith({
        type: AppEvents.alertError.name,
        payload: ['Legacy feature toggle read: "panelTitleSearch"', 'Use OpenFeature instead.'],
      });
    });

    it('does not throw when the app event bus is not wired up yet', () => {
      setAppEvents(undefined as never);
      const config = createConfig({ disableLegacyFeatureToggles: true });

      expect(() => config.featureToggles.panelTitleSearch).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('closes the bootData bypass by sharing one proxy', () => {
      const config = createConfig({ disableLegacyFeatureToggles: true });

      expect(config.bootData.settings.featureToggles).toBe(config.featureToggles);
      expect(config.bootData.settings.featureToggles.panelTitleSearch).toBeUndefined();
    });
  });
});

function createConfig(overrides: Partial<GrafanaConfig>): GrafanaBootConfig {
  const settings: GrafanaConfig = {
    ...window.grafanaBootData.settings,
    featureToggles: {
      panelTitleSearch: true,
      lokiExperimentalStreaming: false,
    },
    ...overrides,
  };
  const bootData: BootData = {
    assets: { dark: '', light: '' },
    navTree: [],
    settings,
    user: { ...window.grafanaBootData.user, theme: 'dark' },
  };

  return new GrafanaBootConfig({ ...settings, bootData });
}
