import { GrafanaEdition } from '@grafana/data/internal';

import { applyBootData } from './index';

describe('applyBootData', () => {
  let originalReduceFlag: boolean | undefined;

  // Snapshot a clean baseline before any test mutates window.grafanaBootData, so each
  // test starts from the same state regardless of what previous tests left behind.
  const baseSettings = { ...window.grafanaBootData.settings };
  const baseUser = { ...window.grafanaBootData.user };

  beforeEach(() => {
    originalReduceFlag = window.__grafanaReduceBootdataAPI;

    // Seed window.grafanaBootData with the values the server embeds into the page.
    window.grafanaBootData.assets = { light: 'light.css', dark: 'dark.css' };
    window.grafanaBootData.navTree = [];
    window.grafanaBootData.user = {
      ...baseUser,
      theme: 'dark',
      lightTheme: false,
    };
    window.grafanaBootData.settings = {
      ...baseSettings,
      appSubUrl: 'from-window',
      buildInfo: {
        ...baseSettings.buildInfo,
        edition: GrafanaEdition.OpenSource,
      },
    };
  });

  afterEach(() => {
    window.__grafanaReduceBootdataAPI = originalReduceFlag;
  });

  // Builds a boot data API response. Spreads the existing (typed) window boot data so we
  // get a structurally valid object without needing to construct a full GrafanaConfig.
  const makeApiBootData = () => ({
    user: { ...window.grafanaBootData.user, login: 'api-user' },
    navTree: [{ id: 'from-api', text: 'From API' }],
    settings: {
      ...window.grafanaBootData.settings,
      appSubUrl: 'from-api',
      appUrl: 'from-api-url',
      buildInfo: {
        ...window.grafanaBootData.settings.buildInfo,
        edition: GrafanaEdition.Enterprise,
      },
    },
  });

  it('merges settings and nav tree from the API when the reduced boot data flag is off', () => {
    window.__grafanaReduceBootdataAPI = false;
    const bootData = makeApiBootData();

    applyBootData(bootData);

    // Existing window settings win over API settings for overlapping keys.
    expect(window.grafanaBootData.settings.appSubUrl).toBe('from-window');
    // API-only keys are merged in.
    expect(window.grafanaBootData.settings.appUrl).toBe('from-api-url');
    // The nav tree comes from the API.
    expect(window.grafanaBootData.navTree).toEqual(bootData.navTree);
    // Build info edition is taken from the API.
    expect(window.grafanaBootData.settings.buildInfo.edition).toBe(GrafanaEdition.Enterprise);
    // The user always comes from the API.
    expect(window.grafanaBootData.user.login).toBe('api-user');
  });

  it('does not merge settings or nav tree when the reduced boot data flag is on', () => {
    window.__grafanaReduceBootdataAPI = true;
    const bootData = makeApiBootData();

    applyBootData(bootData);

    // Settings, nav tree and edition are left as the server embedded them.
    expect(window.grafanaBootData.settings.appSubUrl).toBe('from-window');
    expect(window.grafanaBootData.settings.appUrl).toBeUndefined();
    expect(window.grafanaBootData.navTree).toEqual([]);
    expect(window.grafanaBootData.settings.buildInfo.edition).toBe(GrafanaEdition.OpenSource);
    // The user is still taken from the API.
    expect(window.grafanaBootData.user.login).toBe('api-user');
  });
});
