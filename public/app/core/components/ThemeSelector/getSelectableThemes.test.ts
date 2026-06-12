import { config } from '@grafana/runtime';

import { getSelectableThemes } from './getSelectableThemes';

describe('getSelectableThemes', () => {
  let originalGrafanaconThemes: boolean;
  let originalColorblindThemes: boolean;

  beforeEach(() => {
    originalGrafanaconThemes = config.featureToggles.grafanaconThemes;
    originalColorblindThemes = config.featureToggles.colorblindThemes;
  });

  afterEach(() => {
    config.featureToggles.grafanaconThemes = originalGrafanaconThemes;
    config.featureToggles.colorblindThemes = originalColorblindThemes;
  });

  it('includes ocean blue when grafanaconThemes is enabled', () => {
    config.featureToggles.grafanaconThemes = true;
    config.featureToggles.colorblindThemes = false;

    const themeIds = getSelectableThemes().map((theme) => theme.id);

    expect(themeIds).toContain('oceanblue');
  });

  it('excludes ocean blue when grafanaconThemes is disabled', () => {
    config.featureToggles.grafanaconThemes = false;
    config.featureToggles.colorblindThemes = false;

    const themeIds = getSelectableThemes().map((theme) => theme.id);

    expect(themeIds).not.toContain('oceanblue');
  });
});
