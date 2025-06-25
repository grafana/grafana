// TODO: migrate tests below to the builder

import { createTheme, ThresholdsMode } from '@grafana/data';
import {
  GraphGradientMode,
  AxisPlacement,
  GraphDrawStyle,
  VisibilityMode,
  ScaleOrientation,
  ScaleDirection,
  GraphThresholdsStyleMode,
  ScaleDistribution,
} from '@grafana/schema';

import { UPlotConfigBuilder } from './UPlotConfigBuilder';

describe('UPlotConfigBuilder', () => {
  const darkTheme = createTheme();

  describe('default config', () => {
    it('builds default config', () => {
      const builder = new UPlotConfigBuilder();
      expect(builder.getConfig()).toMatchInlineSnapshot(`
        {
          "axes": [],
          "cursor": {
            "drag": {
              "setScale": false,
            },
            "focus": {
              "prox": 30,
            },
            "points": {
              "fill": [Function],
              "size": [Function],
              "stroke": [Function],
              "width": [Function],
            },
          },
          "focus": {
            "alpha": 1,
          },
          "hooks": {},
          "legend": {
            "show": false,
          },
          "mode": 1,
          "ms": 1,
          "padding": [
            [Function],
            [Function],
            [Function],
            [Function],
          ],
          "scales": {},
          "select": undefined,
          "series": [
            {
              "value": [Function],
            },
          ],
          "tzDate": [Function],
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
        {
          "axes": [],
          "cursor": {
            "drag": {
              "setScale": false,
            },
            "focus": {
              "prox": 30,
            },
            "points": {
              "fill": [Function],
              "size": [Function],
              "stroke": [Function],
              "width": [Function],
            },
          },
          "focus": {
            "alpha": 1,
          },
          "hooks": {},
          "legend": {
            "show": false,
          },
          "mode": 1,
          "ms": 1,
          "padding": [
            [Function],
            [Function],
            [Function],
            [Function],
          ],
          "scales": {
            "scale-x": {
              "auto": false,
              "dir": 1,
              "ori": 0,
              "range": [Function],
              "time": true,
            },
            "scale-y": {
              "asinh": undefined,
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
          "series": [
            {
              "value": [Function],
            },
          ],
          "tzDate": [Function],
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
          {
            "axes": [],
            "cursor": {
              "drag": {
                "setScale": false,
              },
              "focus": {
                "prox": 30,
              },
              "points": {
                "fill": [Function],
                "size": [Function],
                "stroke": [Function],
                "width": [Function],
              },
            },
            "focus": {
              "alpha": 1,
            },
            "hooks": {},
            "legend": {
              "show": false,
            },
            "mode": 1,
            "ms": 1,
            "padding": [
              [Function],
              [Function],
              [Function],
              [Function],
            ],
            "scales": {
              "scale-y": {
                "asinh": undefined,
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
            "series": [
              {
                "value": [Function],
              },
            ],
            "tzDate": [Function],
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
            {
              "axes": [],
              "cursor": {
                "drag": {
                  "setScale": false,
                },
                "focus": {
                  "prox": 30,
                },
                "points": {
                  "fill": [Function],
                  "size": [Function],
                  "stroke": [Function],
                  "width": [Function],
                },
              },
              "focus": {
                "alpha": 1,
              },
              "hooks": {},
              "legend": {
                "show": false,
              },
              "mode": 1,
              "ms": 1,
              "padding": [
                [Function],
                [Function],
                [Function],
                [Function],
              ],
              "scales": {
                "scale-y": {
                  "asinh": undefined,
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
              "series": [
                {
                  "value": [Function],
                },
              ],
              "tzDate": [Function],
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
            {
              "axes": [],
              "cursor": {
                "drag": {
                  "setScale": false,
                },
                "focus": {
                  "prox": 30,
                },
                "points": {
                  "fill": [Function],
                  "size": [Function],
                  "stroke": [Function],
                  "width": [Function],
                },
              },
              "focus": {
                "alpha": 1,
              },
              "hooks": {},
              "legend": {
                "show": false,
              },
              "mode": 1,
              "ms": 1,
              "padding": [
                [Function],
                [Function],
                [Function],
                [Function],
              ],
              "scales": {
                "scale-y": {
                  "asinh": undefined,
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
              "series": [
                {
                  "value": [Function],
                },
              ],
              "tzDate": [Function],
            }
          `);
        });
      });
    });
  });

  it('disables autoscaling when both (and only) hardMin and hardMax are specified', () => {
    const builder = new UPlotConfigBuilder();

    builder.addScale({
      isTime: false,
      scaleKey: 'scale-y',
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      min: -100,
      max: 100,
    });

    builder.addScale({
      isTime: false,
      scaleKey: 'scale-y2',
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      min: -100,
      max: 100,
      softMin: -50,
    });

    expect(builder.getConfig().scales!['scale-y']!.auto).toEqual(false);
    expect(builder.getConfig().scales!['scale-y2']!.auto).toEqual(true);
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
      grid: { show: false },
      show: true,
      theme: darkTheme,
      values: [],
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      {
        "axes": [
          {
            "filter": undefined,
            "font": "12px 'Inter', 'Helvetica', 'Arial', sans-serif",
            "gap": 5,
            "grid": {
              "show": false,
              "stroke": "rgba(240, 250, 255, 0.09)",
              "width": 1,
            },
            "incrs": undefined,
            "label": "test label",
            "labelFont": "12px 'Inter', 'Helvetica', 'Arial', sans-serif",
            "labelGap": 8,
            "labelSize": 20,
            "rotate": undefined,
            "scale": "scale-x",
            "show": true,
            "side": 2,
            "size": [Function],
            "space": [Function],
            "splits": undefined,
            "stroke": "rgb(204, 204, 220)",
            "ticks": {
              "show": true,
              "size": 4,
              "stroke": "rgba(240, 250, 255, 0.09)",
              "width": 1,
            },
            "timeZone": "browser",
            "values": [],
          },
        ],
        "cursor": {
          "drag": {
            "setScale": false,
          },
          "focus": {
            "prox": 30,
          },
          "points": {
            "fill": [Function],
            "size": [Function],
            "stroke": [Function],
            "width": [Function],
          },
        },
        "focus": {
          "alpha": 1,
        },
        "hooks": {},
        "legend": {
          "show": false,
        },
        "mode": 1,
        "ms": 1,
        "padding": [
          [Function],
          [Function],
          [Function],
          [Function],
        ],
        "scales": {},
        "select": undefined,
        "series": [
          {
            "value": [Function],
          },
        ],
        "tzDate": [Function],
      }
    `);
  });

  it('handles auto axis placement', () => {
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
  });

  it('when fillColor is not set fill', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: GraphDrawStyle.Line,
      scaleKey: 'scale-x',
      lineColor: '#0000ff',
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe(undefined);
  });

  it('when fillOpacity is set', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: GraphDrawStyle.Line,
      scaleKey: 'scale-x',
      lineColor: '#FFAABB',
      fillOpacity: 50,
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe('#FFAABB80');
  });

  it('when fillColor is set ignore fillOpacity', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: GraphDrawStyle.Line,
      scaleKey: 'scale-x',
      lineColor: '#FFAABB',
      fillOpacity: 50,
      fillColor: '#FF0000',
      theme: darkTheme,
    });

    expect(builder.getConfig().series[1].fill).toBe('#FF0000');
  });

  it('when fillGradient mode is opacity', () => {
    const builder = new UPlotConfigBuilder();
    builder.addSeries({
      drawStyle: GraphDrawStyle.Line,
      scaleKey: 'scale-x',
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
      drawStyle: GraphDrawStyle.Line,
      scaleKey: 'scale-x',
      fillOpacity: 50,
      gradientMode: GraphGradientMode.Opacity,
      showPoints: VisibilityMode.Auto,
      pointSize: 5,
      lineColor: '#0000ff',
      lineWidth: 1,
      spanNulls: false,
      theme: darkTheme,
    });

    expect(builder.getConfig()).toMatchInlineSnapshot(`
      {
        "axes": [],
        "cursor": {
          "drag": {
            "setScale": false,
          },
          "focus": {
            "prox": 30,
          },
          "points": {
            "fill": [Function],
            "size": [Function],
            "stroke": [Function],
            "width": [Function],
          },
        },
        "focus": {
          "alpha": 1,
        },
        "hooks": {},
        "legend": {
          "show": false,
        },
        "mode": 1,
        "ms": 1,
        "padding": [
          [Function],
          [Function],
          [Function],
          [Function],
        ],
        "scales": {},
        "select": undefined,
        "series": [
          {
            "value": [Function],
          },
          {
            "facets": undefined,
            "fill": [Function],
            "paths": [Function],
            "points": {
              "fill": "#0000ff",
              "filter": undefined,
              "size": 5,
              "stroke": "#0000ff",
            },
            "pxAlign": undefined,
            "scale": "scale-x",
            "show": true,
            "spanGaps": false,
            "stroke": "#0000ff",
            "value": [Function],
            "width": 1,
          },
        ],
        "tzDate": [Function],
      }
    `);
  });

  describe('Stacking', () => {
    it('allows stacking config', () => {
      const builder = new UPlotConfigBuilder();
      builder.addSeries({
        drawStyle: GraphDrawStyle.Line,
        scaleKey: 'scale-x',
        fillOpacity: 50,
        gradientMode: GraphGradientMode.Opacity,
        showPoints: VisibilityMode.Auto,
        lineColor: '#0000ff',
        lineWidth: 1,
        spanNulls: false,
        theme: darkTheme,
      });
      builder.addSeries({
        drawStyle: GraphDrawStyle.Line,
        scaleKey: 'scale-x',
        fillOpacity: 50,
        gradientMode: GraphGradientMode.Opacity,
        showPoints: VisibilityMode.Auto,
        pointSize: 5,
        lineColor: '#00ff00',
        lineWidth: 1,
        spanNulls: false,
        theme: darkTheme,
      });

      builder.addSeries({
        drawStyle: GraphDrawStyle.Line,
        scaleKey: 'scale-x',
        fillOpacity: 50,
        gradientMode: GraphGradientMode.Opacity,
        showPoints: VisibilityMode.Auto,
        pointSize: 5,
        lineColor: '#ff0000',
        lineWidth: 1,
        spanNulls: false,
        theme: darkTheme,
      });

      builder.addBand({
        series: [3, 2],
        fill: 'red',
      });
      builder.addBand({
        series: [2, 1],
        fill: 'blue',
      });

      expect(builder.getConfig()).toMatchInlineSnapshot(`
        {
          "axes": [],
          "bands": [
            {
              "fill": "red",
              "series": [
                3,
                2,
              ],
            },
            {
              "fill": "blue",
              "series": [
                2,
                1,
              ],
            },
          ],
          "cursor": {
            "drag": {
              "setScale": false,
            },
            "focus": {
              "prox": 30,
            },
            "points": {
              "fill": [Function],
              "size": [Function],
              "stroke": [Function],
              "width": [Function],
            },
          },
          "focus": {
            "alpha": 1,
          },
          "hooks": {},
          "legend": {
            "show": false,
          },
          "mode": 1,
          "ms": 1,
          "padding": [
            [Function],
            [Function],
            [Function],
            [Function],
          ],
          "scales": {},
          "select": undefined,
          "series": [
            {
              "value": [Function],
            },
            {
              "facets": undefined,
              "fill": [Function],
              "paths": [Function],
              "points": {
                "fill": "#0000ff",
                "filter": undefined,
                "size": undefined,
                "stroke": "#0000ff",
              },
              "pxAlign": undefined,
              "scale": "scale-x",
              "show": true,
              "spanGaps": false,
              "stroke": "#0000ff",
              "value": [Function],
              "width": 1,
            },
            {
              "facets": undefined,
              "fill": [Function],
              "paths": [Function],
              "points": {
                "fill": "#00ff00",
                "filter": undefined,
                "size": 5,
                "stroke": "#00ff00",
              },
              "pxAlign": undefined,
              "scale": "scale-x",
              "show": true,
              "spanGaps": false,
              "stroke": "#00ff00",
              "value": [Function],
              "width": 1,
            },
            {
              "facets": undefined,
              "fill": [Function],
              "paths": [Function],
              "points": {
                "fill": "#ff0000",
                "filter": undefined,
                "size": 5,
                "stroke": "#ff0000",
              },
              "pxAlign": undefined,
              "scale": "scale-x",
              "show": true,
              "spanGaps": false,
              "stroke": "#ff0000",
              "value": [Function],
              "width": 1,
            },
          ],
          "tzDate": [Function],
        }
      `);
    });
  });

  describe('Thresholds', () => {
    it('Only adds one threshold per scale', () => {
      const builder = new UPlotConfigBuilder();
      const addHookFn = jest.fn();
      builder.addHook = addHookFn;

      builder.addThresholds({
        scaleKey: 'A',
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [],
        },
        config: {
          mode: GraphThresholdsStyleMode.Area,
        },
        theme: darkTheme,
      });
      builder.addThresholds({
        scaleKey: 'A',
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [],
        },
        config: {
          mode: GraphThresholdsStyleMode.Area,
        },
        theme: darkTheme,
      });

      expect(addHookFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Grid lines visibility', () => {
    it('handles auto behaviour', () => {
      const builder = new UPlotConfigBuilder();
      builder.addAxis({
        scaleKey: 'x',
        placement: AxisPlacement.Bottom,
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y1',
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y2',
        theme: darkTheme,
      });
      builder.addAxis({
        scaleKey: 'y3',
        theme: darkTheme,
      });

      const axesConfig = builder.getConfig().axes!;

      expect(axesConfig[0].grid!.show).toBe(true);
      expect(axesConfig[1].grid!.show).toBe(true);
      expect(axesConfig[2].grid!.show).toBe(false);
      expect(axesConfig[3].grid!.show).toBe(false);
    });

    it('handles auto behaviour with explicite grid settings', () => {
      const builder = new UPlotConfigBuilder();
      builder.addAxis({
        scaleKey: 'x',
        placement: AxisPlacement.Bottom,
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y1',
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y2',
        grid: { show: true },
        theme: darkTheme,
      });
      builder.addAxis({
        scaleKey: 'y3',
        theme: darkTheme,
      });

      const axesConfig = builder.getConfig().axes!;

      expect(axesConfig[0].grid!.show).toBe(true);
      expect(axesConfig[1].grid!.show).toBe(true);
      expect(axesConfig[2].grid!.show).toBe(true);
      expect(axesConfig[3].grid!.show).toBe(false);
    });

    it('handles explicit grid settings', () => {
      const builder = new UPlotConfigBuilder();
      builder.addAxis({
        scaleKey: 'x',
        grid: { show: false },
        placement: AxisPlacement.Bottom,
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y1',
        grid: { show: false },
        theme: darkTheme,
      });

      builder.addAxis({
        scaleKey: 'y2',
        grid: { show: true },
        theme: darkTheme,
      });

      const axesConfig = builder.getConfig().axes!;

      expect(axesConfig[0].grid!.show).toBe(false);
      expect(axesConfig[1].grid!.show).toBe(false);
      expect(axesConfig[2].grid!.show).toBe(true);
    });
  });
});
