import { config, reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canFloatExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isFloatingExtensionSidebarHeld,
  releaseFloatingExtensionSidebarHolds,
  resetExtensionSidebarPresentationForTests,
  resolveExtensionSidebarPresentation,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPresentation,
} from './extensionSidebarLayout';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';

describe('extensionSidebarLayout', () => {
  afterEach(() => {
    resetExtensionSidebarPresentationForTests();
    setTestFlags({});
    jest.mocked(reportInteraction).mockClear();
  });

  it('floats only while the flag is on', () => {
    expect(canFloatExtensionSidebar()).toBe(false);
    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('floating');
    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');

    setTestFlags({ [FLOATING_FLAG]: true });
    expect(canFloatExtensionSidebar()).toBe(true);
    setExtensionSidebarPresentation('floating');
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  it('docks with the flag off', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    setTestFlags({ [FLOATING_FLAG]: false });

    setExtensionSidebarPresentation('docked');

    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
  });

  it('floats every page by default', () => {
    expect(getRequestedExtensionSidebarPresentation('/d/abc/my-dashboard')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/dashboard/new')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/notebooks/xyz')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('floating');
  });

  it('remembers the layout for dashboards and notebooks apart from other pages', () => {
    setTestFlags({ [FLOATING_FLAG]: true });

    setExtensionSidebarPresentation('docked', '/d/abc');
    expect(getRequestedExtensionSidebarPresentation('/notebooks/xyz')).toBe('docked');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('floating');

    setExtensionSidebarPresentation('docked', '/explore');
    expect(getRequestedExtensionSidebarPresentation('/alerting/list')).toBe('docked');
    setExtensionSidebarPresentation('floating', '/d/abc');
    expect(getRequestedExtensionSidebarPresentation('/d/abc')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('docked');
  });

  describe('resolveExtensionSidebarPresentation', () => {
    const ASSISTANT = 'grafana-assistant-app';
    const originalToggle = config.featureToggles.restrictedPluginApis;
    const { pluginRestrictedAPIsAllowList, pluginRestrictedAPIsBlockList } = config.bootData.settings;

    // The plugin docks again through the restricted `extensionSidebar` API, so it floats only while it gets it.
    function giveRestrictedApis({
      enabled = true,
      allowList,
      blockList,
    }: {
      enabled?: boolean;
      allowList?: Record<string, string[]>;
      blockList?: Record<string, string[]>;
    }) {
      config.featureToggles.restrictedPluginApis = enabled;
      config.bootData.settings.pluginRestrictedAPIsAllowList = allowList;
      config.bootData.settings.pluginRestrictedAPIsBlockList = blockList;
    }

    afterEach(() => {
      config.featureToggles.restrictedPluginApis = originalToggle;
      config.bootData.settings.pluginRestrictedAPIsAllowList = pluginRestrictedAPIsAllowList;
      config.bootData.settings.pluginRestrictedAPIsBlockList = pluginRestrictedAPIsBlockList;
    });

    it('floats a supporting plugin that gets the extensionSidebar API', () => {
      giveRestrictedApis({ allowList: { extensionSidebar: [ASSISTANT] } });

      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('floating');
      expect(resolveExtensionSidebarPresentation('docked', true, ASSISTANT)).toBe('docked');
      expect(resolveExtensionSidebarPresentation('floating', false, ASSISTANT)).toBe('docked');
    });

    it('docks a plugin that does not support floating, even when it gets the API', () => {
      giveRestrictedApis({ allowList: { extensionSidebar: ['grafana-pathfinder-app'] } });

      expect(resolveExtensionSidebarPresentation('floating', true, 'grafana-pathfinder-app')).toBe('docked');
      expect(resolveExtensionSidebarPresentation('floating', true, undefined)).toBe('docked');
    });

    it('docks while the restrictedPluginApis toggle is off', () => {
      giveRestrictedApis({ enabled: false, allowList: { extensionSidebar: [ASSISTANT] } });

      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('docked');
    });

    it('docks when the allow list does not give the plugin the extensionSidebar API', () => {
      // As on a stack whose allow list has other APIs but no `extensionSidebar` entry.
      giveRestrictedApis({ allowList: { dashboardMutationAPI: [ASSISTANT] } });
      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('docked');

      giveRestrictedApis({ allowList: { extensionSidebar: ['another-app'] } });
      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('docked');

      giveRestrictedApis({});
      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('docked');
    });

    it('applies the block list the same way the restricted APIs provider does', () => {
      giveRestrictedApis({ blockList: { extensionSidebar: [ASSISTANT] } });
      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('docked');

      giveRestrictedApis({ blockList: { extensionSidebar: ['another-app'] } });
      expect(resolveExtensionSidebarPresentation('floating', true, ASSISTANT)).toBe('floating');
    });

    it('docks the default floating layout when the plugin cannot reach the API', () => {
      setTestFlags({ [FLOATING_FLAG]: true });
      giveRestrictedApis({ allowList: { dashboardMutationAPI: [ASSISTANT] } });

      expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');

      giveRestrictedApis({ allowList: { extensionSidebar: [ASSISTANT] } });
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');
    });
  });

  it('holds the floating sidebar hidden until every hold is released, or all are released at once', () => {
    const listener = jest.fn();
    subscribeToExtensionSidebarPresentation(listener);
    expect(isFloatingExtensionSidebarHeld()).toBe(false);

    const releaseA = holdFloatingExtensionSidebar();
    const releaseB = holdFloatingExtensionSidebar();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);
    releaseA();
    releaseA();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);
    releaseB();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    // Two holds and two releases; a repeated release notifies nothing.
    expect(listener).toHaveBeenCalledTimes(4);

    const releaseC = holdFloatingExtensionSidebar();
    releaseFloatingExtensionSidebarHolds();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    // Released already, its own release is harmless.
    releaseC();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('notifies subscribers only when the layout changes', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    const listener = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPresentation(listener);

    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('docked');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setExtensionSidebarPresentation('floating');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports each layout change with the surface it applies to, and nothing for an unchanged or refused one', () => {
    setExtensionSidebarPresentation('docked', '/d/abc');
    setExtensionSidebarPresentation('docked', '/d/abc');
    // Floating is refused while the flag is off.
    setExtensionSidebarPresentation('floating', '/d/abc');
    setTestFlags({ [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating', '/explore');
    setExtensionSidebarPresentation('floating', '/d/abc');

    expect(jest.mocked(reportInteraction).mock.calls).toEqual([
      [
        'grafana_extension_sidebar_presentation_changed',
        { from: 'floating', to: 'docked', surface: 'dashboardOrNotebook' },
      ],
      [
        'grafana_extension_sidebar_presentation_changed',
        { from: 'docked', to: 'floating', surface: 'dashboardOrNotebook' },
      ],
    ]);
  });
});
