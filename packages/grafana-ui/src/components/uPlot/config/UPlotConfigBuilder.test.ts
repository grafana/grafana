// TODO: migrate tests below to the builder

import { UPlotConfigBuilder } from './UPlotConfigBuilder';
import { GrafanaTheme } from '@grafana/data';
import {
  GraphGradientMode,
  AxisPlacement,
  DrawStyle,
  PointVisibility,
  ScaleDistribution,
  ScaleOrientation,
  ScaleDirection,
} from '../config';
import darkTheme from '../../../themes/dark';

describe('UPlotConfigBuilder', () => {
  describe('default config', () => {
    it('builds default config', () => {
      const builder = new UPlotConfigBuilder();
      expect(builder.getConfig()).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "drag": Object {
              "setScale": false,
            },
            "focus": Object {
              "prox": 30,
            },
            "points": Object {
              "fill": [Function],
              "size": [Function],
              "stroke": [Function],
              "width": [Function],
            },
          },
          "hooks": Object {},
          "scales": Object {},
          "select": undefined,
          "series": Array [
            Object {},
          ],
        }
      `);
    });
  });

  describe('scales config', () => {
    it('allows scales configuration', () => {
      const builder = new UPlotConfigBuilder();

      builder.addScale({
        scaleKey: 'scale-x',
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        isTime: true,
      });

      builder.addScale({
        scaleKey: 'scale-y',
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
        isTime: false,
      });

      expect(builder.getConfig()).toMatchInlineSnapshot(`
        Object {
          "axes": Array [],
          "cursor": Object {
            "drag": Object {
              "setScale": false,
            },
            "focus": Object {
              "prox": 30,
            },
            "points": Object {
              "fill": [Function],
              "size": [Function],
              "stroke": [Function],
              "width": [Function],
            },
          },
          "hooks": Object {},
          "scales": Object {
            "scale-x": Object {
              "auto": false,
              "dir": 1,
              "ori": 0,
              "range": [Function],
              "time": true,
            },
            "scale-y": Object {
              "auto": true,
              "dir": 1,
              "distr": 1,
              "log": undefined,
              "ori": 1,
              "range": [Function],
              "time": false,
            },
          },
          "select": undefined,
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
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        isTime: true,
      });

      builder.addScale({
        scaleKey: 'scale-x',
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        isTime: false,
      });

      expect(Object.keys(builder.getConfig().scales!)).toHaveLength(1);
    });

    describe('scale distribution', () => {
      it('allows linear scale configuration', () => {
        const builder = new UPlotConfigBuilder();

        builder.addScale({
          scaleKey: 'scale-y',
          orientation: ScaleOrientation.Vertical,
          direction: ScaleDirection.Up,
          isTime: false,
          distribution: ScaleDistribution.Linear,
        });
        expect(builder.getConfig()).toMatchInlineSnapshot(`
          Object {
            "axes": Array [],
            "cursor": Object {
              "drag": Object {
                "setScale": false,
              },
              "focus": Object {
                "prox": 30,
              },
              "points": Object {
                "fill": [Function],
                "size": [Function],
                "stroke": [Function],
                "width": [Function],
              },
            },
            "hooks": Object {},
            "scales": Object {
              "scale-y": Object {
                "auto": true,
                "dir": 1,
                "distr": 1,
                "log": undefined,
                "ori": 1,
                "range": [Function],
                "time": false,
              },
            },
            "select": undefined,
            "series": Array [
              Object {},
            ],
          }
        `);
      });
      describe('logarithmic scale', () => {
        it('defaults to log2', () => {
          const builder = new UPlotConfigBuilder();

          builder.addScale({
            scaleKey: 'scale-y',
            orientation: ScaleOrientation.Vertical,
            direction: ScaleDirection.Up,
            isTime: false,
            distribution: ScaleDistribution.Linear,
          });

          expect(builder.getConfig()).toMatchInlineSnapshot(`
            Object {
              "axes": Array [],
              "cursor": Object {
                "drag": Object {
                  "setScale": false,
                },
                "focus": Object {
                  "prox": 30,
                },
                "points": Object {
                  "fill": [Function],
                  "size": [Function],
                  "stroke": [Function],
                  "width": [Function],
                },
              },
              "hooks": Object {},
              "scales": Object {
                "scale-y": Object {
                  "auto": true,
                  "dir": 1,
                  "distr": 1,
                  "log": undefined,
                  "ori": 1,
                  "range": [Function],
                  "time": false,
                },
              },
              "select": undefined,
              "series": Array [
                Object {},
              ],
            }
          `);
        });

        it('allows custom log configuration', () => {
          const builder = new UPlotConfigBuilder();

          builder.addScale({
            scaleKey: 'scale-y',
            orientation: ScaleOrientation.Vertical,
            direction: ScaleDirection.Up,
            isTime: false,
            distribution: ScaleDistribution.Linear,
            log: 10,
          });

          expect(builder.getConfig()).toMatchInlineSnapshot(`
            Object {
              "axes": Array [],
              "cursor": Object {
                "drag": Object {
                  "setScale": false,
                },
                "focus": Object {
                  "prox": 30,
                },
                "points": Object {
                  "fill": [Function],
                  "size": [Function],
                  "stroke": [Function],
                  "width": [Function],
                },
              },
              "hooks": Object {},
              "scales": Object {
                "scale-y": Object {
                  "auto": true,
                  "dir": 1,
                  "distr": 1,
                  "log": undefined,
                  "ori": 1,
                  "range": [Function],
                  "time": false,
                },
              },
              "select": undefined,
              "series": Array [
                Object {},
              ],
            }
          `);
        });
      });
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
            "gap": 5,
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
            "splits": undefined,
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
        "cursor": Object {
          "drag": Object {
            "setScale": false,
          },
          "focus": Object {
            "prox": 30,
          },
          "points": Object {
            "fill": [Function],
            "size": [Function],
            "stroke": [Function],
            "width": [Function],
          },
        },
        "hooks": Object {},
        "scales": Object {},
        "select": undefined,
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
      theme: darkTheme,
    });

    builder.addAxis({
      scaleKey: 'y2',
      placement: AxisPlacement.Auto,
      theme: darkTheme,
    });

    expect(builder.getAxisPlacement('y1')).toBe(AxisPlacement.Left);
    expect(builder.getAxisPlacement('y2')).toBe(AxisPlacement.Right);
    expect(builder.getConfig().axes![1].grid!.show).toBe(false);
  });

  it('When fillColor is not set fill', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: DrawStyle.Line,
      scaleKey: 'scale-x',
      fieldName: 'A-series',
      lineColor: '#0000ff',
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe(undefined);
  });

  it('When fillOpacity is set', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: DrawStyle.Line,
      scaleKey: 'scale-x',
      fieldName: 'A-series',
      lineColor: '#FFAABB',
      fillOpacity: 50,
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe('rgba(255, 170, 187, 0.5)');
  });

  it('When fillColor is set ignore fillOpacity', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: DrawStyle.Line,
      scaleKey: 'scale-x',
      fieldName: 'A-series',
      lineColor: '#FFAABB',
      fillOpacity: 50,
      fillColor: '#FF0000',
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe('#FF0000');
  });

  it('When fillGradient mode is opacity', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: DrawStyle.Line,
      scaleKey: 'scale-x',
      fieldName: 'A-series',
      lineColor: '#FFAABB',
      fillOpacity: 50,
      gradientMode: GraphGradientMode.Opacity,
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBeInstanceOf(Function);
  });

  it('allows series configuration', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: DrawStyle.Line,
      scaleKey: 'scale-x',
      fieldName: 'A-series',
      fillOpacity: 50,
      gradientMode: GraphGradientMode.Opacity,
      showPoints: PointVisibility.Auto,
      pointSize: 5,
      pointColor: '#00ff00',
      lineColor: '#0000ff',
      lineWidth: 1,
      spanNulls: false,
      theme: darkTheme,
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      Object {
        "axes": Array [],
        "cursor": Object {
          "drag": Object {
            "setScale": false,
          },
          "focus": Object {
            "prox": 30,
          },
          "points": Object {
            "fill": [Function],
            "size": [Function],
            "stroke": [Function],
            "width": [Function],
          },
        },
        "hooks": Object {},
        "scales": Object {},
        "select": undefined,
        "series": Array [
          Object {},
          Object {
            "fill": [Function],
            "paths": [Function],
            "points": Object {
              "fill": "#00ff00",
              "size": 5,
              "stroke": "#00ff00",
            },
            "scale": "scale-x",
            "show": true,
            "spanGaps": false,
            "stroke": "#0000ff",
            "width": 1,
          },
        ],
      }
    `);
  });
});
