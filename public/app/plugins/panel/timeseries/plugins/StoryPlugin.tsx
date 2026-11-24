import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';

import {
  colorManipulator,
  type DataFrame,
  type DisplayProcessor,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  getFieldSeriesColor,
  type GrafanaTheme2,
} from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR, type UPlotConfigBuilder, useTheme2 } from '@grafana/ui';
import { readDashVar } from 'app/core/dashboardStyle/cssVars';

import { type StoryOptions } from '../panelcfg.gen';

import { layoutAnnotationLabels, findLastIndexInRange, getAnnotationLabelText, spreadLabels } from './story';
import { getXAnnotationFrames } from './utils';

const DIRECT_FONT_SIZE = 12;
const DIRECT_LINE_HEIGHT = 15;
const DIRECT_LEADER_GAP = 8;
const DIRECT_EDGE_GAP = 4;
const DIRECT_MAX_RESERVE = 240;

const ANNO_FONT_SIZE = 11;
const ANNO_ROW_HEIGHT = 14;
const ANNO_ROWS = 3;
const ANNO_BAND = ANNO_ROWS * ANNO_ROW_HEIGHT + 4;
const ANNO_TEXT_OFFSET = 3;
const ANNO_LABEL_GAP = 8;
const ANNO_MIN_TEXT_WIDTH = 48;

interface StorySeries {
  name: string;
  subject: boolean;
  color: string;
  values: unknown[];
  display?: DisplayProcessor;
}

interface StoryAnnotation {
  time: number;
  timeEnd?: number;
  text: string;
  color: string;
}

interface DrawStyle {
  bodyFont: string;
  muted: string;
}

interface StoryPluginProps {
  config: UPlotConfigBuilder;
  alignedFrame: DataFrame;
  annotations?: DataFrame[];
  story: StoryOptions;
  /** Display names of the highlighted series, drawn with semibold labels. */
  subjects?: ReadonlySet<string>;
}

/** Same rule as the default uPlot padding in grafana-ui: 8px on sides without an axis when the plot has cross axes. */
function basePadding(side: number, sidesWithAxes: boolean[]): number {
  const hasCrossAxis = side % 2 ? sidesWithAxes[0] || sidesWithAxes[2] : sidesWithAxes[1] || sidesWithAxes[3];
  return sidesWithAxes[side] || !hasCrossAxis ? 0 : 8;
}

function getStorySeries(frame: DataFrame, subjects: ReadonlySet<string> | undefined, theme: GrafanaTheme2) {
  return frame.fields.map((field) => {
    const name = field.type === FieldType.time ? '' : getFieldDisplayName(field, frame);
    return {
      name,
      subject: subjects?.has(name) ?? false,
      color: getFieldSeriesColor(field, theme).color,
      values: field.values,
      display: field.display,
    };
  });
}

function getStoryAnnotations(annotations: DataFrame[] | undefined, theme: GrafanaTheme2): StoryAnnotation[] {
  const result: StoryAnnotation[] = [];

  for (const frame of getXAnnotationFrames(annotations)) {
    if (frame.meta?.custom?.isWip) {
      continue;
    }
    const field = (name: string) => frame.fields.find((f) => f.name === name)?.values;
    const time = field('time');
    const timeEnd = field('timeEnd');
    const isRegion = field('isRegion');
    const text = field('text');
    const title = field('title');
    const color = field('color');

    if (!time) {
      continue;
    }

    for (let i = 0; i < frame.length; i++) {
      const label = getAnnotationLabelText(text?.[i]) || getAnnotationLabelText(title?.[i]);
      if (!label || typeof time[i] !== 'number') {
        continue;
      }
      result.push({
        time: time[i],
        timeEnd: isRegion?.[i] && typeof timeEnd?.[i] === 'number' ? timeEnd[i] : undefined,
        text: label,
        color: theme.visualization.getColorByName(color?.[i] || DEFAULT_ANNOTATION_COLOR),
      });
    }
  }

  return result;
}

function directLabelText(series: StorySeries, dataIdx: number): string {
  const value = series.values[dataIdx];
  if (!series.display) {
    return series.name;
  }
  return `${series.name}  ${formattedValueToString(series.display(value))}`;
}

/** Truncates text with an ellipsis to fit `maxWidth` in the context's current font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end).trimEnd()}…`).width > maxWidth) {
    end--;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}

function font(weight: number, size: number, family: string) {
  return `${weight} ${size}px ${family}`;
}

/**
 * Reading-first annotations on the time series canvas: series names and last values at the end of each
 * line, and annotation text above the plot with leader lines.
 */
export const StoryPlugin = ({ config, alignedFrame, annotations, story, subjects }: StoryPluginProps) => {
  const theme = useTheme2();

  const storySeries = useMemo(() => getStorySeries(alignedFrame, subjects, theme), [alignedFrame, subjects, theme]);
  const storyAnnotations = useMemo(() => getStoryAnnotations(annotations, theme), [annotations, theme]);

  const seriesRef = useRef<StorySeries[]>(storySeries);
  const annotationsRef = useRef(storyAnnotations);
  const themeRef = useRef(theme);
  const storyRef = useRef(story);

  // declared before the hook setup so draw hooks registered for a new config already see current values
  useLayoutEffect(() => {
    seriesRef.current = storySeries;
    annotationsRef.current = storyAnnotations;
    themeRef.current = theme;
    storyRef.current = story;
  });

  const plotRef = useRef<uPlot | null>(null);
  const bandShownRef = useRef(false);

  useLayoutEffect(() => {
    const { directLabels, annotationLabels } = storyRef.current;
    let style: DrawStyle | undefined;
    let reservedTextWidth = 0;

    const getStyle = (u: uPlot): DrawStyle => {
      if (style) {
        return style;
      }
      const t = themeRef.current;
      const resolved = {
        bodyFont: readDashVar(u.root, 'fontBody', t.typography.fontFamily),
        muted: readDashVar(u.root, 'muted', t.colors.text.secondary),
      };
      // a detached root has no inherited style variables yet, so only cache once mounted
      if (u.root.isConnected) {
        style = resolved;
      }
      return resolved;
    };

    const measureDirectLabels = (u: uPlot): number => {
      const xs = u.data?.[0];
      const min = u.scales.x?.min;
      const max = u.scales.x?.max;
      if (!xs || min == null || max == null) {
        return 0;
      }
      const { bodyFont } = getStyle(u);
      const { fontWeightMedium } = themeRef.current.typography;
      const ctx = u.ctx;
      ctx.save();
      let widest = 0;
      for (let i = 1; i < u.series.length; i++) {
        const series = seriesRef.current[i];
        if (!series || !u.series[i].show) {
          continue;
        }
        const idx = findLastIndexInRange(xs, u.data[i], min, max);
        if (idx < 0) {
          continue;
        }
        ctx.font = font(series.subject ? fontWeightMedium : 400, DIRECT_FONT_SIZE, bodyFont);
        widest = Math.max(widest, ctx.measureText(directLabelText(series, idx)).width);
      }
      ctx.restore();
      return Math.min(Math.ceil(widest), DIRECT_MAX_RESERVE);
    };

    config.setPadding([
      (u, side, sidesWithAxes) => {
        const hasBand = Boolean(annotationLabels && annotationsRef.current.length);
        bandShownRef.current = hasBand;
        return basePadding(side, sidesWithAxes) + (hasBand ? ANNO_BAND : 0);
      },
      (u, side, sidesWithAxes) => {
        const base = basePadding(side, sidesWithAxes);
        if (!directLabels) {
          return base;
        }
        reservedTextWidth = measureDirectLabels(u);
        return reservedTextWidth ? base + DIRECT_LEADER_GAP + reservedTextWidth + DIRECT_EDGE_GAP : base;
      },
      (u, side, sidesWithAxes) => basePadding(side, sidesWithAxes),
      (u, side, sidesWithAxes) => basePadding(side, sidesWithAxes),
    ]);

    config.addHook('init', (u) => {
      plotRef.current = u;
    });

    const drawDirectLabels = (u: uPlot) => {
      const xs = u.data[0];
      const min = u.scales.x?.min;
      const max = u.scales.x?.max;
      if (!xs || min == null || max == null || !reservedTextWidth) {
        return;
      }

      const pr = uPlot.pxRatio;
      const { left, top, width, height } = u.bbox;
      const plotRight = left + width;
      const { bodyFont } = getStyle(u);
      const t = themeRef.current;
      const ctx = u.ctx;

      const indices: number[] = [];
      const texts: string[] = [];
      const colors: string[] = [];
      const endXs: number[] = [];
      const endYs: number[] = [];

      for (let i = 1; i < u.series.length; i++) {
        const series = seriesRef.current[i];
        const scale = u.series[i].scale;
        if (!series || !u.series[i].show || !scale) {
          continue;
        }
        const idx = findLastIndexInRange(xs, u.data[i], min, max);
        if (idx < 0) {
          continue;
        }
        const y = u.valToPos(u.data[i][idx]!, scale, true);
        if (!Number.isFinite(y)) {
          continue;
        }
        indices.push(i);
        texts.push(directLabelText(series, idx));
        colors.push(series.display?.(series.values[idx]).color ?? series.color);
        endXs.push(u.valToPos(xs[idx], 'x', true));
        endYs.push(y);
      }

      if (!indices.length) {
        return;
      }

      const lineHeight = DIRECT_LINE_HEIGHT * pr;
      const ys = spreadLabels(endYs, lineHeight, top + lineHeight / 2, top + height - lineHeight / 2);
      const labelX = (u.width - DIRECT_EDGE_GAP - reservedTextWidth) * pr;
      const leaderEnd = labelX - 3 * pr;

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = pr;

      let widest = 0;
      for (let k = 0; k < indices.length; k++) {
        const series = seriesRef.current[indices[k]];
        const color = colors[k];
        const endX = endXs[k];
        const endY = endYs[k];
        const y = ys[k];

        if (Math.abs(y - endY) > 0.5 * pr || endX < plotRight - 2 * pr) {
          ctx.strokeStyle = colorManipulator.alpha(color, 0.6);
          ctx.beginPath();
          ctx.moveTo(endX + 2 * pr, endY);
          ctx.lineTo(leaderEnd, y);
          ctx.stroke();
        }

        ctx.font = font(series.subject ? t.typography.fontWeightMedium : 400, DIRECT_FONT_SIZE * pr, bodyFont);
        ctx.fillStyle = color;
        ctx.fillText(texts[k], labelX, y);
        widest = Math.max(widest, ctx.measureText(texts[k]).width / pr);
      }

      ctx.restore();

      // the padding is only recomputed on size or scale changes, so grow it when new data widens a label
      if (widest > reservedTextWidth + 1 && reservedTextWidth < DIRECT_MAX_RESERVE) {
        queueMicrotask(() => u.setSize({ width: u.width, height: u.height }));
      }
    };

    const drawAnnotationLabels = (u: uPlot) => {
      const min = u.scales.x?.min;
      const max = u.scales.x?.max;
      const items = annotationsRef.current;
      if (min == null || max == null || !items.length || !bandShownRef.current) {
        return;
      }

      const visible = items.filter((a) =>
        a.timeEnd != null ? a.time <= max && a.timeEnd >= min : a.time >= min && a.time <= max
      );
      if (!visible.length) {
        return;
      }
      visible.sort((a, b) => a.time - b.time);

      const pr = uPlot.pxRatio;
      const { left, top, width, height } = u.bbox;
      const canvasRight = u.width * pr;
      const { bodyFont, muted } = getStyle(u);
      const ctx = u.ctx;

      ctx.save();
      ctx.font = font(400, ANNO_FONT_SIZE * pr, bodyFont);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      const xs = visible.map((a) => Math.round(u.valToPos(Math.max(a.time, min), 'x', true)) + 0.5);
      const widths = visible.map((a) => ctx.measureText(a.text).width);
      const placements = layoutAnnotationLabels(xs, widths, {
        offset: ANNO_TEXT_OFFSET * pr,
        gap: ANNO_LABEL_GAP * pr,
        minX: 0,
        maxX: canvasRight - 2 * pr,
        rows: ANNO_ROWS,
        minWidth: ANNO_MIN_TEXT_WIDTH * pr,
      });

      const rowHeight = ANNO_ROW_HEIGHT * pr;
      const bandTop = top - ANNO_BAND * pr;
      const bottom = top + height;

      ctx.lineWidth = pr;
      for (let k = 0; k < visible.length; k++) {
        const x = Math.min(Math.max(xs[k], left), left + width);
        const placement = placements[k];
        const rowTop = bandTop + (placement?.row ?? ANNO_ROWS - 1) * rowHeight;

        ctx.strokeStyle = colorManipulator.alpha(visible[k].color, 0.7);
        ctx.beginPath();
        ctx.moveTo(x, placement ? rowTop + 2 * pr : bandTop + ANNO_ROWS * rowHeight);
        ctx.lineTo(x, bottom);
        ctx.stroke();

        if (placement) {
          ctx.fillStyle = muted;
          ctx.fillText(fitText(ctx, visible[k].text, placement.width), placement.left, rowTop + rowHeight / 2);
        }
      }

      ctx.restore();
    };

    config.addHook('draw', (u) => {
      if (annotationLabels) {
        drawAnnotationLabels(u);
      }
      if (directLabels) {
        drawDirectLabels(u);
      }
    });
  }, [config]);

  useEffect(() => {
    const u = plotRef.current;
    if (!u || !storyRef.current.annotationLabels) {
      return;
    }
    if (bandShownRef.current !== storyAnnotations.length > 0) {
      u.setSize({ width: u.width, height: u.height });
    } else {
      u.redraw(false);
    }
  }, [storyAnnotations]);

  return null;
};
