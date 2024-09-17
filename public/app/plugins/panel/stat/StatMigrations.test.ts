import { PanelModel } from '@grafana/data';
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
});
