// Library
import React, { useCallback, useMemo } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DefaultTimeZone,
  getFieldColorModeForField,
  getFieldSeriesColor,
  TimeRange,
} from '@grafana/data';
import uPlot, { Axis, Scale, Series, Options } from 'uplot';
import { VizLayout } from '../VizLayout/VizLayout';
import { distribute, SPACE_BETWEEN } from './distribute';
import { Quadtree, Rect } from './quadtree';

// Types
import { VizOrientation } from '@grafana/data';
import { Themeable } from '../../types';
import { BarChartOptions } from './types';
import { useRevision } from '../uPlot/hooks';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '../uPlot/config';
import { useTheme } from '../../themes';

export interface Props extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame;
}

/**
 * @alpha
 */
export const BarChart: React.FunctionComponent<Props> = ({
  width,
  height,
  data,
  orientation,
  groupWidth,
  barWidth,
  ...plotProps
}) => {
  if (!data || data.fields.length < 2) {
    return <div>Missing data</div>;
  }

  // dominik? TODO? can this all be moved into `useRevision`
  const compareFrames = useCallback((a?: DataFrame | null, b?: DataFrame | null) => {
    if (a && b) {
      return compareDataFrameStructures(a, b);
    }
    return false;
  }, []);

  const configRev = useRevision(data, compareFrames);

  const theme = useTheme();

  // Updates only when the structure changes
  const configBuilder = useMemo(() => {
    if (!orientation || orientation === VizOrientation.Auto) {
      orientation = width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    /* eslint-disable */
    // bar orientation -> x scale orientation & direction
    const ori = orientation == VizOrientation.Horizontal ? 1 : 0;
    const dir = orientation == VizOrientation.Horizontal ? -1 : 1;

    const pxRatio    = devicePixelRatio;
    const groupDistr = SPACE_BETWEEN;
    const barDistr   = SPACE_BETWEEN;

    const font       = Math.round(10 * pxRatio) + "px Arial";

    function pointWithin(px: number, py: number, rlft: number, rtop: number, rrgt: number, rbtm: number) {
      return px >= rlft && px <= rrgt && py >= rtop && py <= rbtm;
    }

    type WalkTwoCb = null | ((idx: number, offPx: number, dimPx: number) => void);

    function walkTwo(yIdx: number, xCount: number, yCount: number, xDim: number, xDraw?: WalkTwoCb, yDraw?: WalkTwoCb) {
      distribute(xCount, groupWidth, groupDistr, null, (ix, offPct, dimPct) => {
        let groupOffPx = xDim * offPct;
        let groupWidPx = xDim * dimPct;

        xDraw && xDraw(ix, groupOffPx, groupWidPx);

        yDraw && distribute(yCount, barWidth, barDistr, yIdx, (iy, offPct, dimPct) => {
          let barOffPx = groupWidPx * offPct;
          let barWidPx = groupWidPx * dimPct;

          yDraw(ix, groupOffPx + barOffPx, barWidPx);
        });
      });
    }

    let qt: Quadtree;

    const drawBars: Series.PathBuilder = (u, sidx, i0, i1) => {
      return uPlot.orient(u, sidx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        const fill = new Path2D();

        let numGroups    = dataX.length;
        let barsPerGroup = u.series.length - 1;

        let y0Pos = valToPosY(0, scaleY, yDim, yOff);

        const _dir = dir * (ori === 0 ? 1 : -1);

        walkTwo(sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
          let lft = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
          let barWid = Math.round(wid);

          if (dataY[ix] != null) {
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

            let btm = Math.round(Math.max(yPos, y0Pos));
            let top = Math.round(Math.min(yPos, y0Pos));
            let barHgt = btm - top;

            rect(fill, lft, top, barWid, barHgt);

            let x = ori === 0 ? Math.round(lft - xOff) : 0;
            let y = ori === 0 ? Math.round(top - yOff) : Math.round(lft - xOff);
            let w = ori === 0 ? barWid                 : barHgt;
            let h = ori === 0 ? barHgt                 : barWid;

            qt.add({x, y, w, h, sidx: sidx, didx: ix});
          }
        });

        return {
          stroke: fill,
          fill
        };
      });
    }

    const drawPoints: Series.Points.Show = (u, sidx, i0, i1) => {
      u.ctx.font         = font;
      u.ctx.fillStyle    = "black";
      u.ctx.textAlign    = ori === 0 ? "center" : "left";
      u.ctx.textBaseline = ori === 0 ? "bottom" : "middle";

      uPlot.orient(u, sidx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        let numGroups    = dataX.length;
        let barsPerGroup = u.series.length - 1;

        const _dir = dir * (ori === 0 ? 1 : -1);

        walkTwo(sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
          let lft    = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
          let barWid = Math.round(wid);

          if (dataY[ix] != null) {
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

            let x = ori === 0 ? Math.round(lft + barWid/2) : Math.round(yPos);
            let y = ori === 0 ? Math.round(yPos)           : Math.round(lft + barWid / 2);

            u.ctx.fillText(
              ""+dataY[ix],
              x,
              y,
            );
          }
        });
      });

      return false;
    }

    const yRange: Scale.Range = (u, dataMin, dataMax) => {
      // @ts-ignore
      let [min, max] = uPlot.rangeNum(0, dataMax, 0.05, true);
      return [0, max];
    }

    let hovered: Rect | null = null;

    let barMark = document.createElement("div");
    barMark.classList.add("bar-mark");
    barMark.style.position = "absolute";
    barMark.style.background = "rgba(255,255,255,0.4)";

    const builder = new UPlotConfigBuilder();

    // const xField = data.fields[0];

    builder.addScale({
      scaleKey: 'x',
      isTime: false,
      distribution: ScaleDistribution.Ordinal,
      orientation: ori,
      direction: dir,
    });

    builder.addScale({
      scaleKey: 'y',
      isTime: false,
      orientation: ori == 0 ? 1 : 0,
      range: yRange,
    });

    const xSplits: Axis.Splits = (u: uPlot, axisIdx: number) => {
      const dim = ori == 0 ? u.bbox.width : u.bbox.height;
      const _dir = dir * (ori == 0 ? 1 : -1);

      let splits: number[] = [];

      distribute(u.data[0].length, groupWidth, groupDistr, null, (di, lftPct, widPct) => {
        let groupLftPx = (dim * lftPct) / pxRatio;
        let groupWidPx = (dim * widPct) / pxRatio;

        let groupCenterPx = groupLftPx + groupWidPx / 2;

        splits.push(u.posToVal(groupCenterPx, 'x'));
      });

      return _dir == 1 ? splits : splits.reverse();
    };

    const xValues: Axis.Values = () => data.fields[0].values.toArray();

    builder.addAxis({
      scaleKey: 'x',
      isTime: false,
      placement: ori == 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
      splits: xSplits,
      values: xValues,
      theme,
    });

    builder.addAxis({
      scaleKey: 'y',
      isTime: false,
      placement: ori == 0 ? AxisPlacement.Left : AxisPlacement.Bottom,
      theme,
    });

    // const FIXED_UNIT = '__fixed';

    builder.setXSeries({
      // TODO!
    });

    let seriesIndex = 0;
    for (let i = 1; i < data.fields.length; i++) {
      const field = data.fields[i];
      field.state!.seriesIndex = seriesIndex++;
      // const config = field.config;
      //const customConfig = config.custom;

      // const scaleKey = config.unit || FIXED_UNIT;
      // const colorMode = getFieldColorModeForField(field);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      builder.addSeries({
        scaleKey: i == 0 ? 'x' : 'y',
        lineWidth: 0,
      //lineColor: '#F00', //seriesColor,
        fillColor: seriesColor,
        fillOpacity: 50,
        theme,
        fieldName: field.name,
        pathBuilder: drawBars,
      });
    }

    builder.addHook("init", (u: uPlot) => {
      u.root.querySelector(".u-over")!.appendChild(barMark);
    });

    builder.addHook("drawClear", (u: uPlot) => {
      qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

      qt.clear();

      // force-clear the path cache to cause drawBars() to rebuild new quadtree
      u.series.forEach(s => {
        // @ts-ignore
        s._paths = null;
      });
    });

    builder.addHook("setCursor", (u: uPlot) => {
      let found: Rect | null = null;
      let cx = u.cursor.left! * pxRatio;
      let cy = u.cursor.top! * pxRatio;

      qt.get(cx, cy, 1, 1, o => {
        if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
          found = o;
        }
      });

      if (found) {
        if (found != hovered) {
          barMark.style.display = "";
          barMark.style.left    = (found!.x / pxRatio) + "px";
          barMark.style.top     = (found!.y / pxRatio) + "px";
          barMark.style.width   = (found!.w / pxRatio) + "px";
          barMark.style.height  = (found!.h / pxRatio) + "px";
          hovered = found;
        }
      }
      else if (hovered != null) {
        hovered = null;
        barMark.style.display = "none";
      }
    });

    /*
    builder.addSeries({
      scaleKey: 'y',
      theme,
      lineColor: customConfig.lineColor ?? seriesColor,
      lineWidth: customConfig.lineWidth,
      lineInterpolation: customConfig.lineInterpolation,
      lineStyle: customConfig.lineStyle,
      pointSize: customConfig.pointSize,
      pointColor: customConfig.pointColor ?? seriesColor,
      spanNulls: customConfig.spanNulls || false,
      show: !customConfig.hideFrom?.graph,
      gradientMode: customConfig.gradientMode,
      thresholds: config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex,
      fieldName: getFieldDisplayName(field, alignedFrame),
      hideInLegend: customConfig.hideFrom?.legend,
    });
    */

    let opts = {
      hooks: {
        init: (u: uPlot) => {
          u.root.querySelector(".u-over")!.appendChild(barMark);
        },
        drawClear: (u: uPlot) => {

        },
        setCursor: (u: uPlot) => {

        }
      },
      opts: (u: uPlot, opts: Options) => {
        const yScaleOpts = {
          yRange,
          ori: ori == 0 ? 1 : 0,
        };

        uPlot.assign(opts, {
          select: {show: false},
          cursor: {
            x: false,
            y: false,
            points: {show: false}
          },
          scales: {
            x: {
              time: false,
              distr: 2,
              ori,
              dir,
            },
            rend:   yScaleOpts,
            size:   yScaleOpts,
            mem:    yScaleOpts,
            inter:  yScaleOpts,
            toggle: yScaleOpts,
          }
        });

        if (ori == 1) {
          opts.padding = [0, null, 0, null];
        }

        uPlot.assign(opts.axes![0], {
          gap:        15,
          size:       40,
          labelSize:  20,
          grid:       {show: false},
          ticks:      {show: false},

          side:       ori == 0 ? 2 : 3,
        });

        opts.series.forEach((s, i) => {
          if (i > 0) {
            uPlot.assign(s, {
              width: 0,
              paths: drawBars,
              points: {
                show: drawPoints
              }
            });
          }
        });
      }
    };

    return builder;
    /* eslint-enable */
  }, [data, configRev, orientation, width, height]);

  return (
    <VizLayout width={width} height={height}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart
          data={data}
          config={configBuilder}
          width={vizWidth}
          height={vizHeight}
          timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
          timeZone={DefaultTimeZone}
        />
      )}
    </VizLayout>
  );
};
