import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';

import {
  type DisplayValue,
  type Field,
  type ValueMapping,
  formattedValueToString,
  getActiveThreshold,
  MappingType,
} from '@grafana/data';
import { getValueMappingResult } from '@grafana/data/internal';
import { FieldColorModeId, ThresholdsMode } from '@grafana/schema';

import { TABLE } from '../constants';
import { isTableCellStylesKeyEqual } from '../styles';
import { type StatusCellProps, type TableCellStyles } from '../types';

import { getStyles as getAutoCellStyles } from './AutoCell';
import { TextCellContents } from './TextCellContents';

export type StatusShape = 'circle' | 'triangle' | 'diamond';

const SHAPES: StatusShape[] = ['circle', 'triangle', 'diamond'];

/** The shape for a severity step: the first step is a circle, the second a triangle, any later one a diamond. */
export function getStatusShape(stepIndex: number): StatusShape {
  return SHAPES[Math.min(Math.max(stepIndex, 0), SHAPES.length - 1)];
}

/**
 * Mapping colours in the order an author defined them, each counted once. Value-to-text options
 * are a map whose key order does not survive storage, so their `index` carries the author's order.
 */
const getMappingColors = memoize(
  (mappings: ValueMapping[]): string[] => {
    const colors: string[] = [];
    const add = (color?: string) => {
      if (color != null && !colors.includes(color)) {
        colors.push(color);
      }
    };
    for (const mapping of mappings) {
      if (mapping.type === MappingType.ValueToText) {
        Object.values(mapping.options)
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .forEach((result) => add(result.color));
      } else {
        add(mapping.options.result?.color);
      }
    }
    return colors;
  },
  { maxSize: 20 }
);

/**
 * The severity step of a value, following how the display processor picks its colour: a matching
 * value mapping with a colour wins, otherwise the active threshold step when colouring by thresholds.
 */
export function getStatusStepIndex(field: Field, rawValue: unknown, display: DisplayValue): number {
  const { mappings, thresholds, color } = field.config;

  if (mappings?.length) {
    const mappingColor = getValueMappingResult(mappings, rawValue)?.color;
    if (mappingColor != null) {
      return Math.max(getMappingColors(mappings).indexOf(mappingColor), 0);
    }
  }

  const colorByThresholds = color?.mode == null || color.mode === FieldColorModeId.Thresholds;
  if (!colorByThresholds || !thresholds?.steps.length || Number.isNaN(display.numeric)) {
    return 0;
  }

  const value = thresholds.mode === ThresholdsMode.Percentage ? (display.percent ?? 0) * 100 : display.numeric;
  return Math.max(thresholds.steps.indexOf(getActiveThreshold(value, thresholds.steps)), 0);
}

export function StatusCell({ field, value, rowIdx, tableRefreshEnabled }: StatusCellProps) {
  const display = field.display!(value);
  const text = formattedValueToString(display);

  if (text === '') {
    return null;
  }

  const shape = getStatusShape(getStatusStepIndex(field, value, display));

  return (
    <TextCellContents field={field} rowIdx={rowIdx} tableRefreshEnabled={tableRefreshEnabled}>
      <span data-status-text={shape === 'circle' ? 'plain' : 'emphasised'} title={text}>
        <span
          aria-hidden
          data-status-shape={shape}
          style={display.color ? { backgroundColor: display.color } : undefined}
        />
        {text}
      </span>
    </TextCellContents>
  );
}

export const getStyles: TableCellStyles = memoize(
  (theme, options) =>
    clsx(
      getAutoCellStyles(theme, options),
      css({
        '[data-status-text]': { minWidth: 0 },
        '[data-status-text="emphasised"]': { fontWeight: theme.typography.fontWeightMedium },
        '[data-status-shape]': {
          display: 'inline-block',
          flexShrink: 0,
          width: `${TABLE.STATUS_SHAPE_SIZE_EM}em`,
          height: `${TABLE.STATUS_SHAPE_SIZE_EM}em`,
          marginRight: `${TABLE.STATUS_SHAPE_GAP_EM}em`,
          verticalAlign: '-0.02em',
          backgroundColor: theme.colors.text.secondary,
        },
        '[data-status-shape="circle"]': { borderRadius: theme.shape.radius.circle },
        '[data-status-shape="triangle"]': { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' },
        '[data-status-shape="diamond"]': { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
      })
    ),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
