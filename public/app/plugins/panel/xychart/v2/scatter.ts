import uPlot from 'uplot';

import { formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { AxisPlacement, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData, FacetSeries } from '@grafana/ui/src/components/uPlot/types';

import { pointWithin, Quadtree, Rect } from '../../barchart/quadtree';
import { XYSeries } from '../types2';
import { getCommonPrefixSuffix } from './utils';

interface DrawBubblesOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  disp: {
    //unit: 3,
    size: {
      values: (u: uPlot, seriesIdx: number) => number[];
    };
    color: {
      values: (u: uPlot, seriesIdx: number) => string[];
      alpha: number;
    };
  };
}

export const prepConfig = (xySeries: XYSeries[], theme: GrafanaTheme2) => {
  if (xySeries.length === 0) {
    return { builder: null, prepData: () => [] };
  }

  let qt: Quadtree;
  let hRect: Rect | null;

  function drawBubblesFactory(opts: DrawBubblesOpts) {
    const drawBubbles: uPlot.Series.PathBuilder = (u, seriesIdx, idx0, idx1) => {
      uPlot.orient(
        u,
        seriesIdx,
        (
          series,
          dataX,
          dataY,
          scaleX,
          scaleY,
          valToPosX,
          valToPosY,
          xOff,
          yOff,
          xDim,
          yDim,
          moveTo,
          lineTo,
          rect,
          arc
        ) => {
          const pxRatio = uPlot.pxRatio;
          const scatterInfo = xySeries[seriesIdx - 1];
          let d = u.data[seriesIdx] as unknown as FacetSeries;

          // showLine: boolean;
          // lineStyle: common.LineStyle;
          // showPoints: common.VisibilityMode;

          let showLine = scatterInfo.showLine;
          let showPoints = scatterInfo.showPoints === VisibilityMode.Always;

          let strokeWidth = 1;

          u.ctx.save();

          u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
          u.ctx.clip();

          u.ctx.fillStyle = (series.fill as any)(); // assumes constant
          u.ctx.strokeStyle = (series.stroke as any)();
          u.ctx.lineWidth = strokeWidth;

          let deg360 = 2 * Math.PI;

          let xKey = scaleX.key!;
          let yKey = scaleY.key!;

          // let pointHints = scatterInfo.hints.pointSize;
          // const colorByValue = scatterInfo.hints.pointColor.mode.isByValue;
          const pointHints = { max: undefined, fixed: 5 };
          const colorByValue = false;

          let maxSize = (pointHints.max ?? pointHints.fixed) * pxRatio;

          // todo: this depends on direction & orientation
          // todo: calc once per redraw, not per path
          let filtLft = u.posToVal(-maxSize / 2, xKey);
          let filtRgt = u.posToVal(u.bbox.width / pxRatio + maxSize / 2, xKey);
          let filtBtm = u.posToVal(u.bbox.height / pxRatio + maxSize / 2, yKey);
          let filtTop = u.posToVal(-maxSize / 2, yKey);

          let sizes = opts.disp.size.values(u, seriesIdx);
          let pointColors = opts.disp.color.values(u, seriesIdx);
          let pointAlpha = opts.disp.color.alpha;

          let linePath: Path2D | null = showLine ? new Path2D() : null;

          let curColor: CanvasRenderingContext2D['fillStyle'] | null = null;

          for (let i = 0; i < d[0].length; i++) {
            let xVal = d[0][i];
            let yVal = d[1][i];
            let size = sizes[i] * pxRatio;

            if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
              let cx = valToPosX(xVal, scaleX, xDim, xOff);
              let cy = valToPosY(yVal, scaleY, yDim, yOff);

              if (showLine) {
                linePath!.lineTo(cx, cy);
              }

              if (showPoints) {
                // if pointHints.fixed? don't recalc size
                // if pointColor has 0 opacity, draw as single path (assuming all strokes are alpha 1)

                u.ctx.moveTo(cx + size / 2, cy);
                u.ctx.beginPath();
                u.ctx.arc(cx, cy, size / 2, 0, deg360);

                if (colorByValue) {
                  if (pointColors[i] !== curColor) {
                    curColor = pointColors[i];
                    u.ctx.fillStyle = alpha(curColor, pointAlpha);
                    u.ctx.strokeStyle = curColor;
                  }
                }

                u.ctx.fill();
                u.ctx.stroke();
                opts.each(
                  u,
                  seriesIdx,
                  i,
                  cx - size / 2 - strokeWidth / 2,
                  cy - size / 2 - strokeWidth / 2,
                  size + strokeWidth,
                  size + strokeWidth
                );
              }
            }
          }

          if (showLine) {
            u.ctx.strokeStyle = scatterInfo.color.fixed!;
            u.ctx.lineWidth = scatterInfo.lineWidth * pxRatio;

            const { lineStyle } = scatterInfo;
            if (lineStyle && lineStyle.fill !== 'solid') {
              if (lineStyle.fill === 'dot') {
                u.ctx.lineCap = 'round';
              }
              u.ctx.setLineDash(lineStyle.dash ?? [10, 10]);
            }

            u.ctx.stroke(linePath!);
          }

          u.ctx.restore();
        }
      );

      return null;
    };

    return drawBubbles;
  }

  let drawBubbles = drawBubblesFactory({
    disp: {
      size: {
        //unit: 3, // raw CSS pixels
        values: (u, seriesIdx) => {
          return u.data[seriesIdx][2] as any; // already contains final pixel geometry
          //let [minValue, maxValue] = getSizeMinMax(u);
          //return u.data[seriesIdx][2].map(v => getSize(v, minValue, maxValue));
        },
      },
      color: {
        // string values
        values: (u, seriesIdx) => {
          return u.data[seriesIdx][3] as any;
        },
        alpha: 0.5,
      },
    },
    each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
      // we get back raw canvas coords (included axes & padding). translate to the plotting area origin
      lft -= u.bbox.left;
      top -= u.bbox.top;
      qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
    },
  });

  const builder = new UPlotConfigBuilder();

  builder.setCursor({
    drag: { setScale: true },
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 1) {
        const pxRatio = uPlot.pxRatio;

        hRect = null;

        let dist = Infinity;
        let cx = u.cursor.left! * pxRatio;
        let cy = u.cursor.top! * pxRatio;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            let ocx = o.x + o.w / 2;
            let ocy = o.y + o.h / 2;

            let dx = ocx - cx;
            let dy = ocy - cy;

            let d = Math.sqrt(dx ** 2 + dy ** 2);

            // test against radius for actual hover
            if (d <= o.w / 2) {
              // only hover bbox with closest distance
              if (d <= dist) {
                dist = d;
                hRect = o;
              }
            }
          }
        });
      }

      return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
    },
    points: {
      size: (u, seriesIdx) => {
        return hRect && seriesIdx === hRect.sidx ? hRect.w / uPlot.pxRatio : 0;
      },
      fill: (u, seriesIdx) => 'rgba(255,255,255,0.4)',
    },
  });

  // clip hover points/bubbles to plotting area
  builder.addHook('init', (u, r) => {
    // TODO: re-enable once we global portal again
    //u.over.style.overflow = 'hidden';
  });

  builder.addHook('drawClear', (u) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // force-clear the path cache to cause drawBars() to rebuild new quadtree
    u.series.forEach((s, i) => {
      if (i > 0) {
        // @ts-ignore
        s._paths = null;
      }
    });
  });

  builder.setMode(2);

  let xField = xySeries[0].x.field;

  let fieldConfig = xField.config;
  let customConfig = fieldConfig.custom;
  let scaleDistr = customConfig?.scaleDistribution;

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    distribution: scaleDistr?.type,
    log: scaleDistr?.log,
    linearThreshold: scaleDistr?.linearThreshold,
    min: fieldConfig.min,
    max: fieldConfig.max,
    softMin: customConfig?.axisSoftMin,
    softMax: customConfig?.axisSoftMax,
    centeredZero: customConfig?.axisCenteredZero,
    decimals: fieldConfig.decimals,
  });

  // why does this fall back to '' instead of null or undef?
  let xAxisLabel = customConfig.axisLabel;

  if (xAxisLabel == null || xAxisLabel === '') {
    let dispNames = xySeries.map((s) => s.x.field.state?.displayName ?? '');

    let xAxisAutoLabel =
      xySeries.length === 1
        ? xField.state?.displayName ?? xField.name
        : new Set(dispNames).size === 1
          ? dispNames[0]
          : getCommonPrefixSuffix(dispNames);

    if (xAxisAutoLabel !== '') {
      xAxisLabel = xAxisAutoLabel;
    }
  }

  builder.addAxis({
    scaleKey: 'x',
    placement: customConfig?.axisPlacement !== AxisPlacement.Hidden ? AxisPlacement.Bottom : AxisPlacement.Hidden,
    show: customConfig?.axisPlacement !== AxisPlacement.Hidden,
    grid: { show: customConfig?.axisGridShow },
    border: { show: customConfig?.axisBorderShow },
    theme,
    label: xAxisLabel,
    formatValue: (v, decimals) => formattedValueToString(xField.display!(v, decimals)),
  });

  xySeries.forEach((s, si) => {
    let field = s.y.field;

    const lineColor = s.color.fixed;
    const pointColor = s.color.fixed;
    //const lineColor = s.lineColor(frame);
    //const lineWidth = s.lineWidth;

    let scaleKey = field.config.unit ?? 'y';
    let config = field.config;
    let customConfig = config.custom;
    let scaleDistr = customConfig?.scaleDistribution;

    builder.addScale({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      distribution: scaleDistr?.type,
      log: scaleDistr?.log,
      linearThreshold: scaleDistr?.linearThreshold,
      min: config.min,
      max: config.max,
      softMin: customConfig?.axisSoftMin,
      softMax: customConfig?.axisSoftMax,
      centeredZero: customConfig?.axisCenteredZero,
      decimals: config.decimals,
    });

    // why does this fall back to '' instead of null or undef?
    let yAxisLabel = customConfig.axisLabel;

    if (yAxisLabel == null || yAxisLabel === '') {
      let dispNames = xySeries.map((s) => s.y.field.state?.displayName ?? '');

      let yAxisAutoLabel =
        xySeries.length === 1
          ? field.state?.displayName ?? field.name
          : new Set(dispNames).size === 1
            ? dispNames[0]
            : getCommonPrefixSuffix(dispNames);

      if (yAxisAutoLabel !== '') {
        yAxisLabel = yAxisAutoLabel;
      }
    }

    builder.addAxis({
      scaleKey,
      theme,
      placement: customConfig?.axisPlacement === AxisPlacement.Auto ? AxisPlacement.Left : customConfig?.axisPlacement,
      show: customConfig?.axisPlacement !== AxisPlacement.Hidden,
      grid: { show: customConfig?.axisGridShow },
      border: { show: customConfig?.axisBorderShow },
      size: customConfig?.axisWidth,
      // label: yAxisLabel == null || yAxisLabel === '' ? fieldDisplayName : yAxisLabel,
      label: yAxisLabel,
      formatValue: (v, decimals) => formattedValueToString(field.display!(v, decimals)),
    });

    builder.addSeries({
      facets: [
        {
          scale: 'x',
          auto: true,
        },
        {
          scale: scaleKey,
          auto: true,
        },
      ],
      pathBuilder: drawBubbles, // drawBubbles({disp: {size: {values: () => }}})
      theme,
      scaleKey: '', // facets' scales used (above)
      lineColor: alpha('' + lineColor, 1),
      fillColor: alpha(pointColor ?? '#ffff', 0.5),
      show: !field.state?.hideFrom?.viz,
    });
  });

  /*
  builder.setPrepData((frames) => {
    let seriesData = lookup.fieldMaps.flatMap((f, i) => {
      let { fields } = frames[i];

      return f.y.map((yIndex, frameSeriesIndex) => {
        let xValues = fields[f.x[frameSeriesIndex]].values;
        let yValues = fields[f.y[frameSeriesIndex]].values;
        let sizeValues = f.size![frameSeriesIndex](frames[i]);

        if (!Array.isArray(sizeValues)) {
          sizeValues = Array(xValues.length).fill(sizeValues);
        }

        return [xValues, yValues, sizeValues];
      });
    });

    return [null, ...seriesData];
  });
  */

  return { builder, prepData };
};

export type PrepData = (xySeries: XYSeries[]) => FacetedData;

/**
 * This is called everytime the data changes
 *
 * from?  is this where we would support that?  -- need the previous values
 */
export function prepData(xySeries: XYSeries[]): FacetedData {
  // if (info.error || !data.length) {
  //   return [null];
  // }

  return [
    null,
    ...xySeries.map((s, idx) => {
      let len = s.x.field.values.length;

      let diams: number[];

      if (s.size.field != null) {
        let { min, max } = s.size;

        // todo: this scaling should be in renderer from raw values (not by passing css pixel diams via data)
        let minPx = min! ** 2;
        let maxPx = max! ** 2;
        // use quadratic size scaling in byValue modes
        let pxRange = maxPx - minPx;

        // todo: add shared, local, or key-group min/max option?
        // todo: better min/max with ignoring non-finite values
        // todo: allow this to come from fieldConfig min/max ? or field.state.min/max (shared)
        let vals = s.size.field.values;
        let minVal = Math.min(...vals);
        let maxVal = Math.max(...vals);
        let valRange = maxVal - minVal;

        diams = Array(len);

        for (let i = 0; i < vals.length; i++) {
          let val = vals[i];

          let valPct = (val - minVal) / valRange;
          let pxArea = minPx + valPct * pxRange;
          diams[i] = pxArea ** 0.5;
        }
      } else {
        diams = Array(len).fill(s.size.fixed!);
      }

      return [
        s.x.field.values, // X
        s.y.field.values, // Y
        diams, // TODO: fails for by value
        Array(len).fill(s.color.fixed!), // TODO: fails for by value
      ];
    }),
  ];
}
