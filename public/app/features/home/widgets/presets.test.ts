import { getHomePresets } from './presets';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

describe('getHomePresets', () => {
  it('covers each static homepage widget id in at least one persona', () => {
    const ids = new Set(getHomePresets().flatMap((preset) => preset.widgetIds));

    expect(ids).toEqual(
      new Set(['alerts', 'dashboards', 'incidents', 'oncall', 'kubernetes', 'hosted-metrics', 'hosted-logs', 'slos'])
    );
  });

  it('keeps dashboards as a fallback in every persona', () => {
    expect(getHomePresets().every((preset) => preset.widgetIds.includes('dashboards'))).toBe(true);
  });
});
