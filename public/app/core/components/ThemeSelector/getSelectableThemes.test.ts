import { config } from '@grafana/runtime';

import { getSelectableThemes } from './getSelectableThemes';

describe('getSelectableThemes', () => {
  const originalGrafanaconThemes = config.featureToggles.grafanaconThemes;

  afterEach(() => {
    config.featureToggles.grafanaconThemes = originalGrafanaconThemes;
  });

  it('includes bright pink when grafanacon themes are enabled', () => {
    config.featureToggles.grafanaconThemes = true;

    const themes = getSelectableThemes();

    expect(themes.map((theme) => theme.id)).toContain('brightpink');
  });

  it('does not include bright pink when grafanacon themes are disabled', () => {
    config.featureToggles.grafanaconThemes = false;

    const themes = getSelectableThemes();

    expect(themes.map((theme) => theme.id)).not.toContain('brightpink');
  });
});
