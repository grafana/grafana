import { FieldColorModeId, type PanelModel } from '@grafana/data';
import { BigValueGraphMode, BigValueColorMode, BigValueTextMode } from '@grafana/schema';

import { statPanelChangedHandler } from './StatMigrations';
import { type Options } from './panelcfg.gen';

function makePanel(): PanelModel<Partial<Options>> {
  return { options: {}, fieldConfig: { defaults: {}, overrides: [] } } as unknown as PanelModel<Partial<Options>>;
}

describe('Stat Panel Migrations', () => {
  it.each([
    { desc: 'shown', sparkline: { show: true }, expected: BigValueGraphMode.Area },
    { desc: 'hidden', sparkline: { show: false }, expected: BigValueGraphMode.None },
    { desc: 'absent', sparkline: undefined, expected: BigValueGraphMode.None },
  ])('sets graphMode to $expected when the angular sparkline was $desc', ({ sparkline, expected }) => {
    const options = statPanelChangedHandler(makePanel(), 'singlestat', { angular: { sparkline } });

    expect(options.graphMode).toBe(expected);
  });

  it.each([
    { desc: 'colorBackground is set', angular: { colorBackground: true }, expected: BigValueColorMode.Background },
    { desc: 'colorValue is set', angular: { colorValue: true }, expected: BigValueColorMode.Value },
    {
      desc: 'colorBackground and colorValue are both set',
      angular: { colorBackground: true, colorValue: true },
      expected: BigValueColorMode.Background,
    },
    { desc: 'no color option is set', angular: {}, expected: BigValueColorMode.None },
  ])('sets colorMode to $expected when $desc', ({ angular, expected }) => {
    const options = statPanelChangedHandler(makePanel(), 'singlestat', { angular });

    expect(options.colorMode).toBe(expected);
  });

  it.each([
    { valueName: 'name', expected: BigValueTextMode.Name },
    { valueName: 'avg', expected: undefined },
  ])('maps valueName "$valueName" to textMode $expected', ({ valueName, expected }) => {
    const options = statPanelChangedHandler(makePanel(), 'singlestat', { angular: { valueName } });

    expect(options.textMode).toBe(expected);
  });

  it('maps sparkline.show to Area graphMode for the grafana-singlestat-panel plugin id', () => {
    const old = {
      angular: {
        sparkline: {
          show: true,
        },
      },
    };

    const options = statPanelChangedHandler(makePanel(), 'grafana-singlestat-panel', old);

    expect(options.graphMode).toBe(BigValueGraphMode.Area);
  });

  it('copies the sparkline line color into a fixed field color when a sparkline is shown without colored value/background', () => {
    const old = {
      angular: {
        sparkline: {
          show: true,
          lineColor: 'rgb(31, 120, 193)',
        },
      },
    };

    const panel = makePanel();
    const options = statPanelChangedHandler(panel, 'singlestat', old);

    expect(options.colorMode).toBe(BigValueColorMode.None);
    expect(options.graphMode).toBe(BigValueGraphMode.Area);
    expect(panel.fieldConfig.defaults.color).toEqual({
      mode: FieldColorModeId.Fixed,
      fixedColor: 'rgb(31, 120, 193)',
    });
  });

  it('does not set a fixed field color when the sparkline is hidden', () => {
    const old = {
      angular: {
        sparkline: {
          show: false,
          lineColor: 'rgb(31, 120, 193)',
        },
      },
    };

    const panel = makePanel();
    const options = statPanelChangedHandler(panel, 'singlestat', old);

    expect(options.graphMode).toBe(BigValueGraphMode.None);
    expect(panel.fieldConfig.defaults.color).toBeUndefined();
  });

  it('does not set a fixed field color when the value was already colored', () => {
    const old = {
      angular: {
        colorValue: true,
        sparkline: {
          show: true,
          lineColor: 'rgb(31, 120, 193)',
        },
      },
    };

    const panel = makePanel();
    const options = statPanelChangedHandler(panel, 'singlestat', old);

    expect(options.colorMode).toBe(BigValueColorMode.Value);
    expect(panel.fieldConfig.defaults.color).toBeUndefined();
  });

  it('leaves the field config untouched for a non-singlestat plugin', () => {
    // The angular options are deliberately migratable — only the plugin id keeps the migration from running.
    const old = {
      angular: {
        sparkline: {
          show: true,
          lineColor: 'rgb(31, 120, 193)',
        },
      },
    };

    const panel = makePanel();

    statPanelChangedHandler(panel, 'timeseries', old);

    expect(panel.fieldConfig.defaults).toEqual({});
    expect(panel.fieldConfig.overrides).toEqual([]);
  });
});
