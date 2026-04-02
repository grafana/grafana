import { getBuiltInThemes } from '@grafana/data';

import { getSelectableThemes } from './getSelectableThemes';

jest.mock('@grafana/data', () => ({
  getBuiltInThemes: jest.fn(() => []),
}));

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: {
      grafanaconThemes: false,
    },
  },
}));

const { config } = jest.requireMock('@grafana/runtime');

describe('getSelectableThemes', () => {
  const originalGrafanaConThemesFlag = config.featureToggles.grafanaconThemes;

  afterEach(() => {
    config.featureToggles.grafanaconThemes = originalGrafanaConThemesFlag;
    jest.clearAllMocks();
  });

  it('includes the orange theme when grafanacon themes are enabled', () => {
    config.featureToggles.grafanaconThemes = true;

    getSelectableThemes();

    expect(getBuiltInThemes).toHaveBeenCalledWith([
      'desertbloom',
      'gildedgrove',
      'sapphiredusk',
      'tron',
      'gloom',
      'orange',
    ]);
  });

  it('does not include extra themes when grafanacon themes are disabled', () => {
    config.featureToggles.grafanaconThemes = false;

    getSelectableThemes();

    expect(getBuiltInThemes).toHaveBeenCalledWith([]);
  });
});
