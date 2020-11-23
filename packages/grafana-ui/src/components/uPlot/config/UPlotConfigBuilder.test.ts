// TODO: migrate tests below to the builder

import { UPlotConfigBuilder } from './UPlotConfigBuilder';
import { GrafanaTheme } from '@grafana/data';
import { expect } from '../../../../../../public/test/lib/common';

describe('UPlotConfigBuilder', () => {
  describe('scales config', () => {
    it('allows scales configuration', () => {
      const builder = new UPlotConfigBuilder();
      builder.addScale({
        scaleKey: 'scale-x',
        isTime: true,
      });
      builder.addScale({
        scaleKey: 'scale-y',
        isTime: false,
      });
      expect(builder.getConfig()).toMatchInlineSnapshot(`
      Object {
        "axes": Array [],
        "scales": Object {
          "scale-x": Object {
            "time": true,
          },
          "scale-y": Object {
            "time": false,
          },
        },
        "series": Array [
          Object {},
        ],
      }
    `);
    });

    it('prevents duplicate scales', () => {
      const builder = new UPlotConfigBuilder();
      builder.addScale({
        scaleKey: 'scale-x',
        isTime: true,
      });
      builder.addScale({
        scaleKey: 'scale-x',
        isTime: false,
      });

      expect(Object.keys(builder.getConfig().scales!)).toHaveLength(1);
    });
  });

  it('allows axes configuration', () => {
    const builder = new UPlotConfigBuilder();
    builder.addAxis({
      scaleKey: 'scale-x',
      label: 'test label',
      timeZone: 'browser',
      side: 2,
      isTime: false,
      formatValue: () => 'test value',
      grid: false,
      show: true,
      size: 1,
      stroke: '#ff0000',
      theme: { isDark: true, palette: { gray25: '#ffffff' } } as GrafanaTheme,
      values: [],
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      Object {
        "axes": Array [
          Object {
            "font": "12px Roboto",
            "grid": Object {
              "show": false,
              "stroke": "#ffffff",
              "width": 1,
            },
            "label": "test label",
            "scale": "scale-x",
            "show": true,
            "side": 2,
            "size": [Function],
            "space": [Function],
            "stroke": "#ff0000",
            "ticks": Object {
              "show": true,
              "stroke": "#ffffff",
              "width": 1,
            },
            "timeZone": "browser",
            "values": Array [],
          },
        ],
        "scales": Object {},
        "series": Array [
          Object {},
        ],
      }
    `);
  });
  it('allows series configuration', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      scaleKey: 'scale-x',
      fill: true,
      fillColor: '#ff0000',
      fillOpacity: 0.5,
      points: true,
      pointSize: 5,
      pointColor: '#00ff00',
      line: true,
      lineColor: '#0000ff',
      lineWidth: 1,
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      Object {
        "axes": Array [],
        "scales": Object {},
        "series": Array [
          Object {},
          Object {
            "fill": "rgba(255, 0, 0, 0.5)",
            "points": Object {
              "show": true,
              "size": 5,
              "stroke": "#00ff00",
            },
            "scale": "scale-x",
            "stroke": "#0000ff",
            "width": 1,
          },
        ],
      }
    `);
  });
});
