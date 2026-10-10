import { type CSSProperties } from 'react';

import {
  type DisplayProcessor,
  type FieldConfig,
  GAUGE_DEFAULT_MAXIMUM,
  GAUGE_DEFAULT_MINIMUM,
  getDisplayProcessor,
  type GrafanaTheme2,
  ThresholdsMode,
  VizOrientation,
} from '@grafana/data';

import { clamp } from '../../utils/clamp';
import { getDecadeTicks, getGaugeScaleDistribution, getScaledPercent } from '../../utils/gaugeScale';
import { measureText } from '../../utils/measureText';

const SCALE_LABELS_FONT_SIZE = 12;
const SCALE_LABELS_LINE_HEIGHT = 14;
/** Space between neighbouring labels, and between the labels and the bar */
const SCALE_LABELS_GAP = 4;
/** Height of the label row under a horizontal bar */
export const SCALE_LABELS_HEIGHT = SCALE_LABELS_LINE_HEIGHT + SCALE_LABELS_GAP;

export interface BarGaugeScaleLabel {
  text: string;
  /** Position along the bar, from 0 at min to 1 at max */
  percent: number;
}

/**
 * Returns the labels to show along a bar gauge, most important first: min, max, thresholds,
 * and on a log scale each power of ten.
 */
export function getBarGaugeScaleLabels(field: FieldConfig, display?: DisplayProcessor): BarGaugeScaleLabel[] {
  const min = field.min ?? GAUGE_DEFAULT_MINIMUM;
  const max = field.max ?? GAUGE_DEFAULT_MAXIMUM;
  if (!(max > min)) {
    return [];
  }

  const scale = getGaugeScaleDistribution(field);
  const format = (value: number) => (display ?? getDisplayProcessor())(value).text;
  const candidates = [
    { value: min, text: format(min) },
    { value: max, text: format(max) },
  ];

  const thresholds = field.thresholds;
  for (const step of thresholds?.steps ?? []) {
    if (!Number.isFinite(step.value)) {
      continue;
    }
    if (thresholds?.mode === ThresholdsMode.Percentage) {
      candidates.push({ value: min + (max - min) * (step.value / 100), text: `${step.value}%` });
    } else {
      candidates.push({ value: step.value, text: format(step.value) });
    }
  }

  for (const tick of getDecadeTicks(min, max, scale)) {
    candidates.push({ value: tick, text: format(tick) });
  }

  const labels: BarGaugeScaleLabel[] = [];
  const seen = new Set<number>();
  for (const { value, text } of candidates) {
    if (value < min || value > max || seen.has(value)) {
      continue;
    }
    seen.add(value);
    labels.push({ text, percent: getScaledPercent(value, min, max, scale) });
  }
  return labels;
}

/** Width of the label column beside a vertical bar */
export function getScaleLabelsWidth(labels: BarGaugeScaleLabel[]): number {
  const widest = labels.reduce((width, label) => Math.max(width, getLabelWidth(label.text)), 0);
  return Math.ceil(widest) + SCALE_LABELS_GAP * 2;
}

export interface PlacedScaleLabel {
  text: string;
  /** Distance from the start of the bar (left or bottom) to the start of the label */
  offset: number;
  size: number;
}

/**
 * Centers each label on its position while keeping it inside the bar. Labels are placed in
 * order, and any label that would overlap one already placed is dropped.
 */
export function placeScaleLabels(
  labels: BarGaugeScaleLabel[],
  length: number,
  getSize: (text: string) => number
): PlacedScaleLabel[] {
  const placed: PlacedScaleLabel[] = [];

  for (const label of labels) {
    const size = getSize(label.text);
    if (size > length) {
      continue;
    }

    const offset = clamp(label.percent * length - size / 2, 0, length - size);
    const overlaps = placed.some(
      (other) =>
        offset < other.offset + other.size + SCALE_LABELS_GAP && other.offset < offset + size + SCALE_LABELS_GAP
    );
    if (!overlaps) {
      placed.push({ text: label.text, offset, size });
    }
  }

  return placed;
}

interface Props {
  labels: BarGaugeScaleLabel[];
  /** Length of the bar the labels run along */
  length: number;
  /** Width of the label column, for vertical bars */
  width: number;
  orientation: VizOrientation;
  theme: GrafanaTheme2;
}

export function BarGaugeScaleLabels({ labels, length, width, orientation, theme }: Props) {
  const isVertical = orientation === VizOrientation.Vertical;
  const placed = placeScaleLabels(labels, length, (text) =>
    isVertical ? SCALE_LABELS_LINE_HEIGHT : getLabelWidth(text)
  );

  const containerStyle: CSSProperties = isVertical
    ? { position: 'relative', flexShrink: 0, alignSelf: 'flex-end', width, height: length }
    : { position: 'relative', flexShrink: 0, width: length, height: SCALE_LABELS_HEIGHT };

  return (
    <div style={containerStyle}>
      {placed.map((label) => (
        <span
          key={`${label.text}-${label.offset}`}
          style={{
            position: 'absolute',
            whiteSpace: 'nowrap',
            fontSize: SCALE_LABELS_FONT_SIZE,
            lineHeight: `${SCALE_LABELS_LINE_HEIGHT}px`,
            color: theme.colors.text.secondary,
            ...(isVertical ? { bottom: label.offset, right: SCALE_LABELS_GAP } : { left: label.offset, bottom: 0 }),
          }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

function getLabelWidth(text: string): number {
  return measureText(text, SCALE_LABELS_FONT_SIZE).width;
}
