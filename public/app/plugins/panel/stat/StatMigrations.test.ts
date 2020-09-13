import { PanelModel } from '@grafana/data';
import { statPanelChangedHandler } from './StatMigrations';
import { BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { BigValueTextMode } from '@grafana/ui/src/components/BigValue/BigValue';

describe('Stat Panel Migrations', () => {
  it('change from angular singlestat sparkline disabled', () => {
    const old: any = {
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
    const old: any = {
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
    const old: any = {
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
    const old: any = {
      angular: {
        valueName: 'name',
      },
    };

    const panel = {} as PanelModel;
    const options = statPanelChangedHandler(panel, 'singlestat', old);
    expect(options.textMode).toBe(BigValueTextMode.Name);
  });
});
