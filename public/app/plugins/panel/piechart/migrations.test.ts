import { FieldColorModeId, FieldConfigProperty, FieldMatcherID, PanelModel } from '@grafana/data';

import { PieChartPanelChangedHandler } from './migrations';
import { PieChartLabels } from './models.gen';

describe('PieChart -> PieChartV2 migrations', () => {
  it('only migrates old piechart', () => {
    const panel = {} as PanelModel;

    const options = PieChartPanelChangedHandler(panel, 'some-panel-id', {});
    expect(options).toEqual({});
  });

  it('correctly assigns color overrides', () => {
    const panel = { options: {} } as PanelModel;

    const oldPieChartOptions = {
      angular: {
        aliasColors: { x: '#fff' },
      },
    };
    PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
    expect(panel.fieldConfig.overrides).toContainEqual({
      matcher: {
        id: FieldMatcherID.byName,
        options: 'x',
      },
      properties: [
        {
          id: FieldConfigProperty.Color,
          value: {
            mode: FieldColorModeId.Fixed,
            fixedColor: '#fff',
          },
        },
      ],
    });
  });

  it('correctly sets sum calculation', () => {
    const panel = { options: {} } as PanelModel;

    const oldPieChartOptions = {
      angular: { valueName: 'total' },
    };
    const options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
    expect(options).toMatchObject({ reduceOptions: { calcs: ['sum'] } });
  });

  it('correctly sets labels when old PieChart has legend on graph', () => {
    const panel = { options: {} } as PanelModel;

    const oldPieChartOptions = {
      angular: {
        legendType: 'On graph',
        legend: { values: true },
      },
    };
    const options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
    expect(options).toMatchObject({ displayLabels: [PieChartLabels.Name, PieChartLabels.Value] });
  });

  it('hides the legend when no legend values are selected', () => {
    const panel = { options: {} } as PanelModel;

    const oldPieChartOptions = {
      angular: {
        legendType: 'On graph',
        legend: {},
      },
    };
    const options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
    expect(options).toMatchObject({ legend: { showLegend: false } });
  });
});
