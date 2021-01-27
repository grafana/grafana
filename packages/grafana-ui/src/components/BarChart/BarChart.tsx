// Library
import React, { useCallback, useMemo, useRef } from 'react';
import {
  compareDataFrameStructures,
  DataFrame,
  DefaultTimeZone,
  formattedValueToString,
  getFieldDisplayName,
  getFieldSeriesColor,
  TimeRange,
} from '@grafana/data';
import uPlot, { Axis, Scale, Series } from 'uplot';
import { VizLayout } from '../VizLayout/VizLayout';
import { distribute, SPACE_BETWEEN } from './distribute';
import { Quadtree, Rect } from './quadtree';

// Types
import { VizOrientation } from '@grafana/data';
import { Themeable } from '../../types';
import { BarChartOptions, BarValueVisibility } from './types';
import { useRevision } from '../uPlot/hooks';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { AxisPlacement, ScaleDistribution } from '../uPlot/config';
import { useTheme } from '../../themes';
import { GraphNGLegendEvent } from '../GraphNG/types';
import { mapMouseEventToMode } from '../GraphNG/GraphNG';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';

export interface Props extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame;
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
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
  showValue,
  legend,
  onLegendClick,
  onSeriesColorChange,
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
      if (showValue === BarValueVisibility.Never)
        return false;

      u.ctx.font         = font;
      u.ctx.fillStyle    = "white";
      u.ctx.textAlign    = ori === 0 ? "center" : "left";
      u.ctx.textBaseline = ori === 0 ? "bottom" : "middle";

      uPlot.orient(u, sidx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        let numGroups    = dataX.length;
        let barsPerGroup = u.series.length - 1;

        const _dir = dir * (ori === 0 ? 1 : -1);

        const disp = data.fields[sidx].display!;

        walkTwo(sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
          let lft    = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
          let barWid = Math.round(wid);
          
          if (dataY[ix] != null) {
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

            let x = ori === 0 ? Math.round(lft + barWid/2) : Math.round(yPos);
            let y = ori === 0 ? Math.round(yPos)           : Math.round(lft + barWid / 2);

            u.ctx.fillText(
              formattedValueToString(disp(dataY[ix])),
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

    const xField = data.fields[0];

    const builder = new UPlotConfigBuilder();

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

    const xValues: Axis.Values = () => xField.values.toArray();

    builder.addAxis({
      scaleKey: 'x',
      isTime: false,
      placement: ori == 0 ? AxisPlacement.Bottom : AxisPlacement.Left,
      splits: xSplits,
      values: xValues,
      grid: false,
      ticks: false,
      gap: 15,
      theme,
    });

    builder.addAxis({
      scaleKey: 'y',
      isTime: false,
      placement: ori == 0 ? AxisPlacement.Left : AxisPlacement.Bottom,
      theme,
    });

    // const FIXED_UNIT = '__fixed';

    // why are the fields' seriesIndex props wrong?
    let seriesIndex = 0;

    for (let i = 1; i < data.fields.length; i++) {
      const field = data.fields[i];

      // hack/fix a proper series index
      field.state!.seriesIndex = seriesIndex++;

      // const config = field.config;
      // const customConfig = config.custom;

      // const scaleKey = config.unit || FIXED_UNIT;
      // const colorMode = getFieldColorModeForField(field);
      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      builder.addSeries({
        scaleKey: i == 0 ? 'x' : 'y',
        lineWidth: 0,
        fillColor: seriesColor,
        fillOpacity: 50,
        theme,
        fieldName: getFieldDisplayName(field, data),
        pathBuilder: drawBars,
        pointsBuilder: drawPoints,
        dataFrameFieldIndex: {
          fieldIndex: i,
          frameIndex: 0,
        },

        /*
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineStyle: customConfig.lineStyle,
        show: !customConfig.hideFrom?.graph,
        gradientMode: customConfig.gradientMode,
        thresholds: config.thresholds,

        // The following properties are not used in the uPlot config, but are utilized as transport for legend config
        dataFrameFieldIndex,
        fieldName: getFieldDisplayName(field, alignedFrame),
        hideInLegend: customConfig.hideFrom?.legend,
        */
      });
    }

    builder.addHook("init", (u: uPlot) => {
      u.root.querySelector(".u-over")!.appendChild(barMark);
    });

    builder.addHook("drawClear", (u: uPlot) => {
      qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

      qt.clear();

      // force-clear the path cache to force drawBars() to rebuild new quadtree
      u.series.forEach(s => {
        // @ts-ignore
        s._paths = null;
      });
    });

    // handle hover interaction with quadtree probing
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

    // hide crosshair cursor & hover points
    builder.setCursor({
      x: false,
      y: false,
      points: {show: false}
    });

    // disable selection
    builder.setSelect({
      show: false
    });

    return builder;
    /* eslint-enable */
  }, [data, configRev, orientation, width, height]);

  const onLabelClick = useCallback(
    (legend: VizLegendItem, event: React.MouseEvent) => {
      const { fieldIndex } = legend;

      if (!onLegendClick || !fieldIndex) {
        return;
      }

      onLegendClick({
        fieldIndex,
        mode: mapMouseEventToMode(event),
      });
    },
    [onLegendClick, data]
  );

  const hasLegend = useRef(legend && legend.displayMode !== LegendDisplayMode.Hidden);

  const legendItems = configBuilder
    .getSeries()
    .map<VizLegendItem | undefined>((s) => {
      const seriesConfig = s.props;
      const fieldIndex = seriesConfig.dataFrameFieldIndex;
      const axisPlacement = configBuilder.getAxisPlacement(s.props.scaleKey);

      if (seriesConfig.hideInLegend || !fieldIndex) {
        return undefined;
      }

      // const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

      // // Hackish: when the data prop and config builder are not in sync yet
      // if (!field) {
      //   return undefined;
      // }

      return {
        disabled: !seriesConfig.show ?? false,
        fieldIndex,
        color: seriesConfig.fillColor!,
        label: seriesConfig.fieldName,
        yAxis: axisPlacement === AxisPlacement.Left ? 1 : 2,
        getDisplayValues: () => [],
      };
    })
    .filter((i) => i !== undefined) as VizLegendItem[];

  let legendElement: React.ReactElement | undefined;

  if (hasLegend && legendItems.length > 0) {
    legendElement = (
      <VizLayout.Legend position={legend.placement} maxHeight="35%" maxWidth="60%">
        <VizLegend
          onLabelClick={onLabelClick}
          placement={legend.placement}
          items={legendItems}
          displayMode={legend.displayMode}
          onSeriesColorChange={onSeriesColorChange}
        />
      </VizLayout.Legend>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={legendElement}>
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
