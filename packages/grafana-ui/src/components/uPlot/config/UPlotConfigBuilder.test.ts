// TODO: migrate tests below to the builder

import { UPlotConfigBuilder } from './UPlotConfigBuilder';
import { GrafanaTheme } from '@grafana/data';
import { expect } from '../../../../../../public/test/lib/common';
import { AxisPlacement, GraphMode, PointMode } from '../config';

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
              "range": [Function],
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
      placement: AxisPlacement.Bottom,
      isTime: false,
      formatValue: () => 'test value',
      grid: false,
      show: true,
      theme: { isDark: true, palette: { gray25: '#ffffff' }, colors: { text: 'gray' } } as GrafanaTheme,
      values: [],
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      Object {
        "axes": Array [
          Object {
            "font": "12px 'Roboto'",
            "grid": Object {
              "show": false,
              "stroke": "#ffffff",
              "width": 1,
            },
            "label": "test label",
            "labelFont": "12px 'Roboto'",
            "labelSize": 18,
            "scale": "scale-x",
            "show": true,
            "side": 2,
            "size": [Function],
            "space": [Function],
            "stroke": "gray",
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

  it('Handles auto axis placement', () => {
    const builder = new UPlotConfigBuilder();
    builder.addAxis({
      scaleKey: 'y1',
      placement: AxisPlacement.Auto,
      theme: { isDark: true, palette: { gray25: '#ffffff' } } as GrafanaTheme,
    });
    builder.addAxis({
      scaleKey: 'y2',
      placement: AxisPlacement.Auto,
      theme: { isDark: true, palette: { gray25: '#ffffff' } } as GrafanaTheme,
    });

    expect(builder.getAxisPlacement('y1')).toBe(AxisPlacement.Left);
    expect(builder.getAxisPlacement('y2')).toBe(AxisPlacement.Right);
  });

  it('allows series configuration', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      mode: GraphMode.Line,
      scaleKey: 'scale-x',
      fillColor: '#ff0000',
      fillOpacity: 0.5,
      points: PointMode.Auto,
      pointSize: 5,
      pointColor: '#00ff00',
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
            "paths": [Function],
            "points": Object {
              "fill": "#00ff00",
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
