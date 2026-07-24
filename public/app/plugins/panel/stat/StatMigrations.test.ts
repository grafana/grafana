import { FieldColorModeId, type PanelModel } from '@grafana/data';
import { BigValueGraphMode, BigValueColorMode, BigValueTextMode } from '@grafana/schema';

import { statPanelChangedHandler } from './StatMigrations';

describe('Stat Panel Migrations', () => {
  it('change from angular singlestat sparkline disabled', () => {
    const old = {
      angular: {
        format: 'ms',
        decimals: 7,
        sparkline: {
          show: false,
        },
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.graphMode).toBe(BigValueGraphMode.None);
  });

  it('change from angular singlestat sparkline enabled', () => {
    const old = {
      angular: {
        format: 'ms',
        decimals: 7,
        sparkline: {
          show: true,
        },
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.graphMode).toBe(BigValueGraphMode.Area);
  });

  it('change from angular singlestat color background', () => {
    const old = {
      angular: {
        format: 'ms',
        decimals: 7,
        colorBackground: true,
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.colorMode).toBe(BigValueColorMode.Background);
  });

  it('change from angular singlestat with name stat', () => {
    const old = {
      angular: {
        valueName: 'name',
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.textMode).toBe(BigValueTextMode.Name);
  });

  it('use no color unless one was configured', () => {
    const old = {
      angular: {
        valueName: 'name',
      },
    };

    let panel = {} as PanelModel;
    let options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.colorMode).toBe(BigValueColorMode.None);

    const oldWithColorBackground = {
      angular: {
        valueName: 'name',
        colorBackground: true,
      },
    };

    panel = {} as PanelModel;
    options = statPanelChangedHandler(panel, 'singlestat', oldWithColorBackground);
    expect(options.colorMode).toBe(BigValueColorMode.Background);
  });

  it('maps colorValue to value color mode', () => {
    const old = {
      angular: {
        colorValue: true,
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.colorMode).toBe(BigValueColorMode.Value);
  });

  it('also migrates from the grafana-singlestat-panel plugin id', () => {
    const old = {
      angular: {
        sparkline: {
          show: true,
        },
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'grafana-singlestat-panel', old);
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

    const panel = { fieldConfig: { defaults: {}, overrides: [] } } as unknown as PanelModel;
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

    const panel = { fieldConfig: { defaults: {}, overrides: [] } } as unknown as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);

    expect(options.graphMode).toBe(BigValueGraphMode.None);
    expect(panel.fieldConfig.defaults.color).toBeUndefined();
  });

  it('does not touch the field config when there is no angular config to migrate', () => {
    const old = {};

    const panel = { fieldConfig: { defaults: {}, overrides: [] } } as unknown as PanelModel;
    // The angular migration branch is skipped, so the field config is left as-is.
    expect(() => statPanelChangedHandler(panel, 'timeseries', old)).not.toThrow();
    expect(panel.fieldConfig.defaults.color).toBeUndefined();
  });
});
