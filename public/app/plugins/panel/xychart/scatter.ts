import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import {
  FALLBACK_COLOR,
  type Field,
  FieldType,
  formattedValueToString,
  getFieldConfigWithMinMax,
  getFieldColorModeForField,
  getValueFormat,
  type GrafanaTheme2,
  MappingType,
  SpecialValueMatch,
  stringToJsRegex,
  ThresholdsMode,
  type ValueMapping,
  type ValueMappingResult,
  colorManipulator,
  type EnumFieldConfig,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { AxisPlacement, FieldColorModeId, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { type FacetedData, type FacetSeries } from '@grafana/ui/internal';

import { pointWithin, Quadtree, type Rect } from '../barchart/quadtree';
import { valuesToFills } from '../heatmap/utils';

import { PointShape } from './panelcfg.gen';
import { type XYSeries } from './types2';
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
    return { builder: null, prepData: () => [], warn: t('xychart.errors.nodata', 'No data') };
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
          let pointPalette = (dispColors[seriesIdx - 1].index.color ?? []) as Array<
            CanvasRenderingContext2D['fillStyle']
          >;
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
                    let c =
                      curColorIdx === undefined || curColorIdx === -1 ? FALLBACK_COLOR : pointPalette[curColorIdx];
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
      index: {
        color: [],
        text: [],
        icon: [],
      },
      getAll: () => [],
      getOne: () => -1,
      // cache for renderer, refreshed in prepData()
      values: [],
      hasAlpha: false,
    };

    const f = s.color.field;

    if (f != null) {
      Object.assign(cfg, getEnumConfig(f, theme));
      cfg.hasAlpha = cfg.index.color!.some((v) => !(v as string).endsWith('ff'));
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

  return { builder, prepData, warn: null };
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

export interface FieldColorValues {
  index: EnumFieldConfig;
  getOne: GetOneValue;
  getAll: GetAllValues;
}
interface FieldColorValuesWithCache extends FieldColorValues {
  values: number[];
  hasAlpha: boolean;
}
type GetAllValues = (values: unknown[], min?: number, max?: number) => number[];
type GetOneValue = (value: unknown, min?: number, max?: number) => number;

function getLabelForRange(from: number | null, to: number | null) {
  let text: string;

  if (from != null) {
    if (to != null) {
      text = `${from} - ${to}`;
    } else {
      text = `≥ ${from}`;
    }
  } else {
    if (to != null) {
      text = `≤ ${to}`;
    } else {
      text = '';
    }
  }

  return text;
}

function getSpecialValueLabel(match: SpecialValueMatch) {
  switch (match) {
    case SpecialValueMatch.NaN:
      return 'NaN';
    case SpecialValueMatch.NullAndNaN:
      return 'null/NaN';
    case SpecialValueMatch.Empty:
      return '""';
    default:
      return match;
  }
}

function getMappingResult(mapping: ValueMapping, value: unknown): ValueMappingResult | undefined {
  if (mapping.type === MappingType.ValueToText) {
    return mapping.options[String(value)];
  }

  if (mapping.type === MappingType.RangeToText) {
    if (value == null) {
      return undefined;
    }

    const numeric = parseFloat(String(value));
    if (
      Number.isNaN(numeric) ||
      (mapping.options.from != null && numeric < mapping.options.from) ||
      (mapping.options.to != null && numeric > mapping.options.to)
    ) {
      return undefined;
    }

    return mapping.options.result;
  }

  if (mapping.type === MappingType.RegexToText) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const regex = stringToJsRegex(mapping.options.pattern);
    if (!value.match(regex)) {
      return undefined;
    }

    const result = { ...mapping.options.result };
    if (result.text != null) {
      result.text = value.replace(regex, result.text);
    }
    return result;
  }

  const match = mapping.options.match;
  const matches =
    match === SpecialValueMatch.Null
      ? value == null
      : match === SpecialValueMatch.NaN
        ? typeof value === 'number' && Number.isNaN(value)
        : match === SpecialValueMatch.NullAndNaN
          ? value == null || (typeof value === 'number' && Number.isNaN(value))
          : match === SpecialValueMatch.True
            ? value === true || value === 'true'
            : match === SpecialValueMatch.False
              ? value === false || value === 'false'
              : value === '';

  return matches ? mapping.options.result : undefined;
}

/** compiler for values to palette color idxs (from thresholds, mappings, by-value gradients) */
export function getEnumConfig(f: Field, theme: GrafanaTheme2): FieldColorValues {
  const index: EnumFieldConfig = {
    color: [],
    text: [],
    icon: [],
  };

  let getAll: GetAllValues = () => [];
  let getOne: GetOneValue = () => -1;

  let conds = '';

  // if any mappings exist, use them regardless of other settings
  if ((f.config.mappings?.length ?? 0) > 0) {
    const mappings = f.config.mappings!;

    // this is color+text+icon that deduplicates the index above
    // e.g. if multiple values + ranges map "OK"+"green", this ensures they map to same state by key
    const keys: string[] = [];

    function indexOf(color = FALLBACK_COLOR, text = '', icon = '') {
      const resolvedColor = getHex8Color(color, theme);
      const key = `${resolvedColor}|${text}|${icon}`;

      let idx = keys.indexOf(key);

      if (idx === -1) {
        idx = keys.length;
        keys.push(key);

        index.color!.push(resolvedColor);
        index.text!.push(text);
        index.icon!.push(icon);
      }

      return idx;
    }

    for (const m of mappings) {
      if (m.type === MappingType.ValueToText) {
        for (const [value, result] of Object.entries(m.options)) {
          indexOf(result.color, result.text ?? value, result.icon);
        }
      } else if (m.type === MappingType.RangeToText) {
        const { from, to, result } = m.options;
        if (from != null || to != null) {
          indexOf(result.color, result.text ?? getLabelForRange(from, to), result.icon);
        }
      } else if (m.type === MappingType.SpecialValue) {
        const { match, result } = m.options;
        indexOf(result.color, result.text ?? getSpecialValueLabel(match), result.icon);
      }
    }

    getOne = (value) => {
      for (const mapping of mappings) {
        const result = getMappingResult(mapping, value);

        if (result == null) {
          continue;
        }

        let text = result.text;
        if (text == null) {
          if (mapping.type === MappingType.ValueToText) {
            text = String(value);
          } else if (mapping.type === MappingType.RangeToText) {
            text = getLabelForRange(mapping.options.from, mapping.options.to);
          } else if (mapping.type === MappingType.SpecialValue) {
            text = getSpecialValueLabel(mapping.options.match);
          } else {
            text = String(value);
          }
        }

        return indexOf(result.color, text, result.icon);
      }

      return -1;
    };
    getAll = (values) => values.map((value) => getOne(value));
  } else if (f.config.color?.mode === FieldColorModeId.Thresholds && (f.config.thresholds?.steps.length ?? 0) > 1) {
    const thresholds = f.config.thresholds!;
    const steps = thresholds.steps;

    index.color = steps.map((step) => getHex8Color(step.color, theme));
    index.icon = Array(steps.length).fill('');

    if (thresholds.mode === ThresholdsMode.Absolute) {
      let lasti = steps.length - 1;

      for (let i = lasti; i > 0; i--) {
        let rhs = Number(steps[i].value);
        conds += `v >= ${rhs} ? ${i} : `;
      }

      conds += '0';

      index.text = steps.map((s, i) => (i === 0 ? `< ${steps[i + 1].value}` : getLabelForRange(s.value, null)));
    } else {
      const { min: fieldMin = 0, max: fieldMax = 0 } = getFieldConfigWithMinMax(f);
      const hasExplicitRange = typeof f.config.min === 'number' && typeof f.config.max === 'number';
      const formatPercent = getValueFormat('percent');

      index.text = steps.map(
        (step) => `${formattedValueToString(formatPercent(step.value, f.config.decimals))}+`
      );

      getOne = (value, min = fieldMin, max = fieldMax) => {
        const rangeMin = hasExplicitRange ? fieldMin : min;
        const rangeMax = hasExplicitRange ? fieldMax : max;
        const delta = rangeMax - rangeMin;
        const percent = delta === 0 ? 0 : ((Number(value) - rangeMin) / delta) * 100;

        for (let i = steps.length - 1; i > 0; i--) {
          if (percent >= steps[i].value) {
            return i;
          }
        }

        return 0;
      };
      getAll = (values, min, max) => values.map((value) => getOne(value, min, max));
    }
  } else if (f.config.color?.mode?.startsWith('continuous')) {
    let calc = getFieldColorModeForField(f).getCalculator(f, theme);

    index.color = Array(32);

    for (let i = 0; i < index.color.length; i++) {
      let pct = i / (index.color.length - 1);
      index.color[i] = getHex8Color(calc(pct, pct), theme);
    }

    getAll = (vals, min, max) => valuesToFills(vals as number[], index.color!, min!, max!);
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
