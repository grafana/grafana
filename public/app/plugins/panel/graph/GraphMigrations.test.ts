import { PanelModel } from '@grafana/data';
import { graphPanelMigrationHandler, graphPanelChangedHandler } from './GraphMigrations';

describe('Graph Panel Migrations', () => {
  it('from 6.7.1', () => {
    // Saved from play dashboard
    const panel = {
      datasource: 'graphite',
      aliasColors: {
        cpu1: '#82b5d8',
        cpu2: '#1f78c1',
        upper_25: '#B7DBAB',
        upper_50: '#7EB26D',
        upper_75: '#629E51',
        upper_90: '#629E51',
        upper_95: '#508642',
      },
      annotate: {
        enable: false,
      },
      bars: false,
      dashLength: 10,
      dashes: false,
      editable: true,
      fill: 3,
      fillGradient: 0,
      grid: {
        max: null,
        min: null,
      },
      gridPos: {
        h: 7,
        w: 24,
        x: 0,
        y: 21,
      },
      hiddenSeries: false,
      id: 11,
      interactive: true,
      legend: {
        alignAsTable: true,
        avg: true,
        current: true,
        legendSideLastValue: true,
        max: false,
        min: false,
        rightSide: true,
        show: true,
        total: false,
        values: true,
      },
      legend_counts: true,
      lines: true,
      linewidth: 2,
      links: [],
      nullPointMode: 'connected',
      options: {
        dataLinks: [],
      },
      paceLength: 10,
      percentage: false,
      pointradius: 1,
      points: false,
      renderer: 'flot',
      resolution: 100,
      scale: 1,
      seriesOverrides: [
        {
          alias: 'this is  test of brekaing',
          yaxis: 1,
        },
      ],
      spaceLength: 10,
      spyable: true,
      stack: false,
      steppedLine: false,
      targets: [
        {
          refId: 'A',
          target: 'aliasByNode(statsd.fakesite.timers.ads_timer.*,4)',
        },
        {
          refId: 'B',
          target: "alias(scale(statsd.fakesite.timers.ads_timer.upper_95,-1),'cpu1')",
        },
        {
          refId: 'C',
          target: "alias(scale(statsd.fakesite.timers.ads_timer.upper_75,-1),'cpu2')",
        },
      ],
      thresholds: [],
      timeFrom: null,
      timeRegions: [],
      timeShift: null,
      timezone: 'browser',
      title: 'Traffic In/Out',
      tooltip: {
        query_as_alias: true,
        shared: true,
        sort: 0,
        value_type: 'cumulative',
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
          decimals: 2,
          format: 'decbytes',
          logBase: 1,
          max: null,
          min: null,
          show: true,
        },
        {
          decimals: 4,
          format: 'short',
          logBase: 1,
          max: null,
          min: null,
          show: false,
        },
      ],
      yaxis: {
        align: false,
        alignLevel: null,
      },
      zerofill: true,
    } as Omit<PanelModel, 'fieldConfig'>;

    const result = graphPanelMigrationHandler(panel as PanelModel);
    console.log('RRRR', result);
  });
});
