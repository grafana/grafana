import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import { GraphMode, LineConfig, AreaConfig, PointsConfig, PointMode, LineInterpolation } from '../config';
import { PlotConfigBuilder } from '../types';

export interface SeriesProps extends LineConfig, AreaConfig, PointsConfig {
  mode: GraphMode;
  scaleKey: string;
}

function buildBarsPaths(u: uPlot, seriesIdx: number, idx0: number, idx1: number): Series.Paths {
  let series = u.series[seriesIdx];
  let scaleKey = series.scale as string;

  const gapFactor = 0.25;

  let gap = (u.width * gapFactor) / (idx1 - idx0);
  let maxWidth = Infinity;

  //@ts-ignore
  let fillTo = series.fillTo(u, seriesIdx, series.min, series.max);

  let y0Pos = u.valToPos(fillTo, scaleKey, true);
  let colWid = u.bbox.width / (idx1 - idx0);

  let strokeWidth = Math.round(series.width! * devicePixelRatio);

  let wid = Math.round(Math.min(maxWidth, colWid - gap) - strokeWidth);

  let stroke = new Path2D();

  for (let i = idx0; i <= idx1; i++) {
    let yVal = u.data[seriesIdx][i];

    if (yVal == null) {
      continue;
    }

    let xVal = u.scales.x.distr === 2 ? i : u.data[0][i];

    // TODO: all xPos can be pre-computed once for all series in aligned set
    let xPos = u.valToPos(xVal, 'x', true);
    let yPos = u.valToPos(yVal, scaleKey, true);

    let lft = Math.round(xPos - wid / 2);
    let btm = Math.round(Math.max(yPos, y0Pos));
    let top = Math.round(Math.min(yPos, y0Pos));
    let hgt = btm - top;

    stroke.rect(lft, top, wid, hgt);
  }

  let fill = series.fill != null ? new Path2D(stroke) : undefined;

  return {
    stroke,
    fill,
  };
}

function buildStaircasePaths(u: uPlot, seriesIdx: number, idx0: number, idx1: number): Series.Paths {
  const s = u.series[seriesIdx];
  const xdata = u.data[0];
  const ydata = u.data[seriesIdx];
  const scaleX = 'x';
  const scaleY = s.scale as string;

  const stroke = new Path2D();
  stroke.moveTo(Math.round(u.valToPos(xdata[0], scaleX, true)), Math.round(u.valToPos(ydata[0]!, scaleY, true)));

  for (let i = idx0; i <= idx1 - 1; i++) {
    let x0 = Math.round(u.valToPos(xdata[i], scaleX, true));
    let y0 = Math.round(u.valToPos(ydata[i]!, scaleY, true));
    let x1 = Math.round(u.valToPos(xdata[i + 1], scaleX, true));
    let y1 = Math.round(u.valToPos(ydata[i + 1]!, scaleY, true));

    stroke.lineTo(x0, y0);
    stroke.lineTo(x1, y0);

    if (i === idx1 - 1) {
      stroke.lineTo(x1, y1);
    }
  }

  const fill = new Path2D(stroke);

  //@ts-ignore
  let fillTo = s.fillTo(u, seriesIdx, s.min, s.max);

  let minY = Math.round(u.valToPos(fillTo, scaleY, true));
  let minX = Math.round(u.valToPos(u.scales[scaleX].min!, scaleX, true));
  let maxX = Math.round(u.valToPos(u.scales[scaleX].max!, scaleX, true));

  fill.lineTo(maxX, minY);
  fill.lineTo(minX, minY);

  return {
    stroke,
    fill,
  };
}

// adapted from https://gist.github.com/nicholaswmin/c2661eb11cad5671d816 (MIT)
/**
 * Interpolates a Catmull-Rom Spline through a series of x/y points
 * Converts the CR Spline to Cubic Beziers for use with SVG items
 *
 * If 'alpha' is 0.5 then the 'Centripetal' variant is used
 * If 'alpha' is 1 then the 'Chordal' variant is used
 *
 *
 * @param  {Array} data - Array of points, each point in object literal holding x/y values
 * @return {String} d - SVG string with cubic bezier curves representing the Catmull-Rom Spline
 */
function catmullRomFitting(data: Array<{ x: number; y: number }>, alpha: number) {
  const path = new Path2D();

  let p0, p1, p2, p3, bp1, bp2, d1, d2, d3, A, B, N, M, d3powA, d2powA, d3pow2A, d2pow2A, d1pow2A, d1powA;

  path.moveTo(Math.round(data[0].x), Math.round(data[0].y));

  for (let i = 0; i < data.length - 1; i++) {
    p0 = i === 0 ? data[0] : data[i - 1];
    p1 = data[i];
    p2 = data[i + 1];
    p3 = i + 2 < data.length ? data[i + 2] : p2;

    d1 = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
    d2 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    d3 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));

    // Catmull-Rom to Cubic Bezier conversion matrix

    // A = 2d1^2a + 3d1^a * d2^a + d3^2a
    // B = 2d3^2a + 3d3^a * d2^a + d2^2a

    // [   0             1            0          0          ]
    // [   -d2^2a /N     A/N          d1^2a /N   0          ]
    // [   0             d3^2a /M     B/M        -d2^2a /M  ]
    // [   0             0            1          0          ]

    d3powA = Math.pow(d3, alpha);
    d3pow2A = Math.pow(d3, 2 * alpha);
    d2powA = Math.pow(d2, alpha);
    d2pow2A = Math.pow(d2, 2 * alpha);
    d1powA = Math.pow(d1, alpha);
    d1pow2A = Math.pow(d1, 2 * alpha);

    A = 2 * d1pow2A + 3 * d1powA * d2powA + d2pow2A;
    B = 2 * d3pow2A + 3 * d3powA * d2powA + d2pow2A;
    N = 3 * d1powA * (d1powA + d2powA);

    if (N > 0) {
      N = 1 / N;
    }

    M = 3 * d3powA * (d3powA + d2powA);

    if (M > 0) {
      M = 1 / M;
    }

    bp1 = {
      x: (-d2pow2A * p0.x + A * p1.x + d1pow2A * p2.x) * N,
      y: (-d2pow2A * p0.y + A * p1.y + d1pow2A * p2.y) * N,
    };

    bp2 = {
      x: (d3pow2A * p1.x + B * p2.x - d2pow2A * p3.x) * M,
      y: (d3pow2A * p1.y + B * p2.y - d2pow2A * p3.y) * M,
    };

    if (bp1.x === 0 && bp1.y === 0) {
      bp1 = p1;
    }

    if (bp2.x === 0 && bp2.y === 0) {
      bp2 = p2;
    }

    path.bezierCurveTo(bp1.x, bp1.y, bp2.x, bp2.y, p2.x, p2.y);
  }

  return path;
}

function buildSmoothPaths(u: uPlot, seriesIdx: number, idx0: number, idx1: number): Series.Paths {
  const s = u.series[seriesIdx];
  const xdata = u.data[0];
  const ydata = u.data[seriesIdx];
  const scaleX = 'x';
  const scaleY = s.scale as string;

  const stroke = catmullRomFitting(
    xdata.map((x, i) => ({
      x: u.valToPos(xdata[i], scaleX, true),
      y: u.valToPos(ydata[i]!, scaleY, true),
    })),
    0.5
  );

  const fill = new Path2D(stroke);

  //@ts-ignore
  let fillTo = s.fillTo(u, seriesIdx, s.min, s.max);

  let minY = Math.round(u.valToPos(fillTo, scaleY, true));
  let minX = Math.round(u.valToPos(u.scales[scaleX].min!, scaleX, true));
  let maxX = Math.round(u.valToPos(u.scales[scaleX].max!, scaleX, true));

  fill.lineTo(maxX, minY);
  fill.lineTo(minX, minY);

  return {
    stroke,
    fill,
  };
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      mode,
      lineInterpolation,
      lineColor,
      lineWidth,
      points,
      pointColor,
      pointSize,
      fillColor,
      fillOpacity,
      scaleKey,
    } = this.props;

    let lineConfig: Partial<Series> = {};

    if (mode === GraphMode.Points) {
      lineConfig.paths = () => null;
    } else {
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
      lineConfig.paths = (self: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
        let pathsBuilder = self.paths;

        if (mode === GraphMode.Bars) {
          pathsBuilder = buildBarsPaths;
        } else if (mode === GraphMode.Line) {
          if (lineInterpolation === LineInterpolation.Staircase) {
            pathsBuilder = buildStaircasePaths;
          } else if (lineInterpolation === LineInterpolation.Smooth) {
            pathsBuilder = buildSmoothPaths;
          }
        }

        return pathsBuilder(self, seriesIdx, idx0, idx1);
      };
    }

    const pointsConfig: Partial<Series> = {
      points: {
        stroke: pointColor,
        fill: pointColor,
        size: pointSize,
      },
    };

    // we cannot set points.show property above (even to undefined) as that will clear uPlot's default auto behavior
    if (points === PointMode.Auto) {
      if (mode === GraphMode.Bars) {
        pointsConfig.points!.show = false;
      }
    } else if (points === PointMode.Never) {
      pointsConfig.points!.show = false;
    } else if (points === PointMode.Always) {
      pointsConfig.points!.show = true;
    }

    const areaConfig =
      fillOpacity !== undefined
        ? {
            fill: tinycolor(fillColor)
              .setAlpha(fillOpacity)
              .toRgbString(),
          }
        : { fill: undefined };

    return {
      scale: scaleKey,
      ...lineConfig,
      ...pointsConfig,
      ...areaConfig,
    };
  }
}
