var mockFeatureToggles: { colorblindThemes: boolean; grafanaconThemes: boolean };

jest.mock('@grafana/runtime', () => {
  mockFeatureToggles = { colorblindThemes: false, grafanaconThemes: false };
  return {
    config: { featureToggles: mockFeatureToggles },
  };
});

import { getSelectableThemes } from './getSelectableThemes';

describe('getSelectableThemes', () => {
  afterEach(() => {
    mockFeatureToggles.colorblindThemes = false;
    mockFeatureToggles.grafanaconThemes = false;
  });

  it('always includes the bright pink theme', () => {
    mockFeatureToggles.colorblindThemes = false;
    mockFeatureToggles.grafanaconThemes = false;

    const ids = getSelectableThemes().map((t) => t.id);

    expect(ids).toContain('brightpink');
  });

  it('adds colorblind themes when the feature toggle is enabled', () => {
    mockFeatureToggles.colorblindThemes = true;
    mockFeatureToggles.grafanaconThemes = false;

    const ids = getSelectableThemes().map((t) => t.id);

    expect(ids).toContain('brightpink');
    expect(ids).toContain('deuteranopia_protanopia_dark');
    expect(ids).toContain('tritanopia_light');
  });

  it('adds Grafanacon themes when the feature toggle is enabled', () => {
    mockFeatureToggles.colorblindThemes = false;
    mockFeatureToggles.grafanaconThemes = true;

    const ids = getSelectableThemes().map((t) => t.id);

    expect(ids).toContain('brightpink');
    expect(ids).toContain('desertbloom');
    expect(ids).toContain('gloom');
  });
});
