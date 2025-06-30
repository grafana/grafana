import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import {
  FALLBACK_COLOR,
  Field,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  GrafanaTheme2,
  MappingType,
  SpecialValueMatch,
  ThresholdsMode,
  colorManipulator,
} from '@grafana/data';
import { AxisPlacement, FieldColorModeId, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData, FacetSeries } from '@grafana/ui/internal';

import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { valuesToFills } from '../heatmap/utils';

import { PointShape } from './panelcfg.gen';
import { XYSeries } from './types2';
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
          let strokeWidth = scatterInfo.pointStrokeWidth ?? 0;

          u.ctx.save();

          u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
          u.ctx.clip();

          let pointAlpha = scatterInfo.fillOpacity / 100;

          u.ctx.fillStyle = colorManipulator.alpha((series.fill as any)(), pointAlpha);
          u.ctx.strokeStyle = colorManipulator.alpha((series.stroke as any)(), 1);
          u.ctx.lineWidth = strokeWidth;

          let deg360 = 2 * Math.PI;

          let xKey = scaleX.key!;
          let yKey = scaleY.key!;

          //const colorMode = getFieldColorModeForField(field); // isByValue
          const pointSize = scatterInfo.y.field.config.custom.pointSize;
          const colorByValue = scatterInfo.color.field != null; // && colorMode.isByValue;

          let maxSize = (pointSize.max ?? pointSize.fixed) * pxRatio;

          // todo: this depends on direction & orientation
          // todo: calc once per redraw, not per path
          let filtLft = u.posToVal(-maxSize / 2, xKey);
          let filtRgt = u.posToVal(u.bbox.width / pxRatio + maxSize / 2, xKey);
          let filtBtm = u.posToVal(u.bbox.height / pxRatio + maxSize / 2, yKey);
          let filtTop = u.posToVal(-maxSize / 2, yKey);

          let sizes = opts.disp.size.values(u, seriesIdx);
          // let pointColors = opts.disp.color.values(u, seriesIdx);
          let pointColors = dispColors[seriesIdx - 1].values; // idxs
          let pointPalette = dispColors[seriesIdx - 1].index as Array<CanvasRenderingContext2D['fillStyle']>;
          let paletteHasAlpha = dispColors[seriesIdx - 1].hasAlpha;

          let isSquare = scatterInfo.pointShape === PointShape.Square;

          let linePath: Path2D | null = showLine ? new Path2D() : null;

          let curColorIdx = -1;

          for (let i = 0; i < d[0].length; i++) {
            let xVal = d[0][i];
            let yVal = d[1][i];

            if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
              let size = Math.round(sizes[i] * pxRatio);
              let cx = valToPosX(xVal, scaleX, xDim, xOff);
              let cy = valToPosY(yVal, scaleY, yDim, yOff);

              if (showLine) {
                linePath!.lineTo(cx, cy);
              }

              if (showPoints) {
                if (colorByValue) {
                  if (pointColors[i] !== curColorIdx) {
                    curColorIdx = pointColors[i];
                    let c = curColorIdx === -1 ? FALLBACK_COLOR : pointPalette[curColorIdx];
                    u.ctx.fillStyle = paletteHasAlpha ? c : colorManipulator.alpha(c as string, pointAlpha);
                    u.ctx.strokeStyle = colorManipulator.alpha(c as string, 1);
                  }
                }

                if (isSquare) {
                  let x = Math.round(cx - size / 2);
                  let y = Math.round(cy - size / 2);

                  if (colorByValue || pointAlpha > 0) {
                    u.ctx.fillRect(x, y, size, size);
                  }

                  if (strokeWidth > 0) {
                    u.ctx.strokeRect(x, y, size, size);
                  }
                } else {
                  u.ctx.beginPath();
                  u.ctx.arc(cx, cy, size / 2, 0, deg360);

                  if (colorByValue || pointAlpha > 0) {
                    u.ctx.fill();
                  }

                  if (strokeWidth > 0) {
                    u.ctx.stroke();
                  }
                }

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
    u.over.style.overflow = 'hidden';
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
  let xIsTime = xField.type === FieldType.time;

  let fieldConfig = xField.config;
  let customConfig = fieldConfig.custom;
  let scaleDistr = customConfig?.scaleDistribution;

  builder.addScale({
    scaleKey: 'x',
    isTime: xIsTime,
    auto: true,
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
    range: xIsTime ? (u, min, max) => [min, max] : undefined,
  });

  // why does this fall back to '' instead of null or undef?
  let xAxisLabel = customConfig.axisLabel;

  if (xAxisLabel == null || xAxisLabel === '') {
    let dispNames = xySeries.map((s) => s.x.field.state?.displayName ?? '');

    let xAxisAutoLabel =
      xySeries.length === 1
        ? (xField.state?.displayName ?? xField.name)
        : new Set(dispNames).size === 1
          ? dispNames[0]
          : getCommonPrefixSuffix(dispNames);

    if (xAxisAutoLabel !== '') {
      xAxisLabel = xAxisAutoLabel;
    }
  }

  builder.addAxis({
    scaleKey: 'x',
    isTime: xIsTime,
    placement: customConfig?.axisPlacement !== AxisPlacement.Hidden ? AxisPlacement.Bottom : AxisPlacement.Hidden,
    show: customConfig?.axisPlacement !== AxisPlacement.Hidden,
    grid: { show: customConfig?.axisGridShow },
    border: { show: customConfig?.axisBorderShow },
    theme,
    label: xAxisLabel,
    formatValue: xIsTime ? undefined : (v, decimals) => formattedValueToString(xField.display!(v, decimals)),
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
          ? (field.state?.displayName ?? field.name)
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
      lineColor: colorManipulator.alpha(lineColor ?? '#ffff', 1),
      fillColor: colorManipulator.alpha(pointColor ?? '#ffff', 0.5),
      show: !field.state?.hideFrom?.viz,
    });
  });

  const dispColors = xySeries.map((s): FieldColorValuesWithCache => {
    const cfg: FieldColorValuesWithCache = {
      index: [],
      getAll: () => [],
      getOne: () => -1,
      // cache for renderer, refreshed in prepData()
      values: [],
      hasAlpha: false,
    };

    const f = s.color.field;

    if (f != null) {
      Object.assign(cfg, fieldValueColors(f, theme));
      cfg.hasAlpha = cfg.index.some((v) => !(v as string).endsWith('ff'));
    }

    return cfg;
  });

  function prepData(xySeries: XYSeries[]): FacetedData {
    // if (info.error || !data.length) {
    //   return [null];
    // }

    const { size: sizeRange, color: colorRange } = getGlobalRanges(xySeries);

    xySeries.forEach((s, i) => {
      dispColors[i].values = dispColors[i].getAll(s.color.field?.values ?? [], colorRange.min, colorRange.max);
    });

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

          let vals = s.size.field.values;
          let minVal = sizeRange.min;
          let maxVal = sizeRange.max;
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
          diams,
          Array(len).fill(s.color.fixed!), // TODO: fails for by value
        ];
      }),
    ];
  }

  return { builder, prepData };
};

export type PrepData = (xySeries: XYSeries[]) => FacetedData;

const getGlobalRanges = (xySeries: XYSeries[]) => {
  const ranges = {
    size: {
      min: Infinity,
      max: -Infinity,
    },
    color: {
      min: Infinity,
      max: -Infinity,
    },
  };

  xySeries.forEach((series) => {
    [series.size, series.color].forEach((facet, fi) => {
      if (facet.field != null) {
        let range = fi === 0 ? ranges.size : ranges.color;

        const vals = facet.field.values;

        for (let i = 0; i < vals.length; i++) {
          const v = vals[i];

          if (v != null) {
            if (v < range.min) {
              range.min = v;
            }

            if (v > range.max) {
              range.max = v;
            }
          }
        }
      }
    });
  });

  return ranges;
};

function getHex8Color(color: string, theme: GrafanaTheme2) {
  return tinycolor(theme.visualization.getColorByName(color)).toHex8String();
}

interface FieldColorValues {
  index: unknown[];
  getOne: GetOneValue;
  getAll: GetAllValues;
}
interface FieldColorValuesWithCache extends FieldColorValues {
  values: number[];
  hasAlpha: boolean;
}
type GetAllValues = (values: unknown[], min?: number, max?: number) => number[];
type GetOneValue = (value: unknown, min?: number, max?: number) => number;

/** compiler for values to palette color idxs (from thresholds, mappings, by-value gradients) */
function fieldValueColors(f: Field, theme: GrafanaTheme2): FieldColorValues {
  let index: unknown[] = [];
  let getAll: GetAllValues = () => [];
  let getOne: GetOneValue = () => -1;

  let conds = '';

  // if any mappings exist, use them regardless of other settings
  if (f.config.mappings?.length ?? 0 > 0) {
    let mappings = f.config.mappings!;

    for (let i = 0; i < mappings.length; i++) {
      let m = mappings[i];

      if (m.type === MappingType.ValueToText) {
        for (let k in m.options) {
          let { color } = m.options[k];

          if (color != null) {
            let rhs = f.type === FieldType.string ? JSON.stringify(k) : Number(k);
            conds += `v === ${rhs} ? ${index.length} : `;
            index.push(getHex8Color(color, theme));
          }
        }
      } else if (m.options.result.color != null) {
        let { color } = m.options.result;

        if (m.type === MappingType.RangeToText) {
          let range = [];

          if (m.options.from != null) {
            range.push(`v >= ${Number(m.options.from)}`);
          }

          if (m.options.to != null) {
            range.push(`v <= ${Number(m.options.to)}`);
          }

          if (range.length > 0) {
            conds += `${range.join(' && ')} ? ${index.length} : `;
            index.push(getHex8Color(color, theme));
          }
        } else if (m.type === MappingType.SpecialValue) {
          let spl = m.options.match;

          if (spl === SpecialValueMatch.NaN) {
            conds += `isNaN(v)`;
          } else if (spl === SpecialValueMatch.NullAndNaN) {
            conds += `v == null || isNaN(v)`;
          } else {
            conds += `v ${
              spl === SpecialValueMatch.True
                ? '=== true'
                : spl === SpecialValueMatch.False
                  ? '=== false'
                  : spl === SpecialValueMatch.Null
                    ? '== null'
                    : spl === SpecialValueMatch.Empty
                      ? '=== ""'
                      : '== null'
            }`;
          }

          conds += ` ? ${index.length} : `;
          index.push(getHex8Color(color, theme));
        } else if (m.type === MappingType.RegexToText) {
          // TODO
        }
      }
    }

    conds += '-1'; // ?? what default here? null? FALLBACK_COLOR?
  } else if (f.config.color?.mode === FieldColorModeId.Thresholds) {
    if (f.config.thresholds?.mode === ThresholdsMode.Absolute) {
      let steps = f.config.thresholds.steps;
      let lasti = steps.length - 1;

      for (let i = lasti; i > 0; i--) {
        let rhs = Number(steps[i].value);
        conds += `v >= ${rhs} ? ${i} : `;
      }

      conds += '0';

      index = steps.map((s) => getHex8Color(s.color, theme));
    } else {
      // TODO: percent thresholds?
    }
  } else if (f.config.color?.mode?.startsWith('continuous')) {
    let calc = getFieldColorModeForField(f).getCalculator(f, theme);

    index = Array(32);

    for (let i = 0; i < index.length; i++) {
      let pct = i / (index.length - 1);
      index[i] = getHex8Color(calc(pct, pct), theme);
    }

    getAll = (vals, min, max) => valuesToFills(vals as number[], index as string[], min!, max!);
  }

  if (conds !== '') {
    getOne = new Function('v', `return ${conds};`) as GetOneValue;

    getAll = new Function(
      'vals',
      `
      let idxs = Array(vals.length);

      for (let i = 0; i < vals.length; i++) {
        let v = vals[i];
        idxs[i] = ${conds};
      }

      return idxs;
    `
    ) as GetAllValues;
  }

  return {
    index,
    getOne,
    getAll,
  };
}
