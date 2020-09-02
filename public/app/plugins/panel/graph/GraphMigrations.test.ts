import { PanelModel, FieldConfigSource } from '@grafana/data';
import { graphPanelMigrationHandler } from './GraphMigrations';

describe('Graph Panel Migrations', () => {
  it('from 7.0', () => {
    const panel = {
      aliasColors: {},
      bars: false,
      dashLength: 10,
      dashes: false,
      fill: 1,
      fillGradient: 0,
      gridPos: {
        h: 8,
        w: 9,
        x: 6,
        y: 0,
      },
      hiddenSeries: false,
      id: 23763571993,
      legend: {
        avg: false,
        current: false,
        max: false,
        min: false,
        show: true,
        total: false,
        values: false,
      },
      lines: true,
      linewidth: 1,
      nullPointMode: 'null',
      options: {
        dataLinks: [
          {
            targetBlank: false,
            title: 'Drill it down',
            url: 'THE DRILLDOWN URL',
          },
        ],
      },
      percentage: false,
      pointradius: 2,
      points: false,
      renderer: 'flot',
      seriesOverrides: [
        {
          alias: 'Bar datacenter {datacenter="baz", region="us-east-2"}',
          yaxis: 2,
        },
      ],
      spaceLength: 10,
      stack: false,
      steppedLine: false,
      targets: [
        {
          alias: 'Foo datacenter',
          labels: 'datacenter=foo,region=us-east-1',
          refId: 'A',
          scenarioId: 'random_walk',
        },
        {
          alias: 'Bar datacenter',
          labels: 'datacenter=bar,region=us-east-2',
          refId: 'B',
          scenarioId: 'random_walk',
        },
        {
          alias: 'Bar datacenter',
          labels: 'datacenter=baz,region=us-east-2',
          refId: 'C',
          scenarioId: 'random_walk',
        },
      ],
      thresholds: [],
      timeFrom: null,
      timeRegions: [],
      timeShift: null,
      title: 'Multiple series',
      tooltip: {
        shared: true,
        sort: 0,
        value_type: 'individual',
      },
      type: 'graph',
      xaxis: {
        buckets: null,
        mode: 'time',
        name: null,
        show: true,
        values: [],
      },
      yaxes: [
        {
          format: 'percent',
          label: null,
          logBase: 1,
          max: null,
          min: null,
          show: true,
          $$hashKey: 'object:122',
        },
        {
          format: 'gflops',
          label: null,
          logBase: 1,
          max: null,
          min: null,
          show: true,
          $$hashKey: 'object:123',
        },
      ],
      yaxis: {
        align: false,
        alignLevel: null,
      },
      datasource: null,
    } as Omit<PanelModel, 'fieldConfig'>;

    const result = graphPanelMigrationHandler(panel as PanelModel);
    const fieldSource = (panel as any).fieldConfig as FieldConfigSource;

    expect(result.dataLinks).toBeUndefined();
    expect(fieldSource.defaults.links).toHaveLength(1);

    const link = fieldSource.defaults.links![0];
    expect(link.url).toEqual('THE DRILLDOWN URL');
  });

  it('from 7.1 it should preserve existing fieldConfig', () => {
    const panel = ({
      id: 1,
      fieldConfig: {
        defaults: {
          links: [
            {
              title: 'Details',
              url: '/link',
            },
          ],
        },
        overrides: [],
      },
    } as unknown) as PanelModel;

    graphPanelMigrationHandler(panel as PanelModel);
    const fieldConfig = (panel as any).fieldConfig as FieldConfigSource;
    expect(fieldConfig.defaults.links).toHaveLength(1);
  });
});
