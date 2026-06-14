import {
  cacheFieldDisplayNames,
  type DataFrame,
  type DisplayProcessor,
  type Field,
  FieldType,
  getFieldDisplayName,
  getFieldSeriesColor,
  type GrafanaTheme2,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { findField } from 'app/features/dimensions/utils';

import { setClassicPaletteIdxs } from '../timeseries/utils';

import { type BoxplotFieldMap } from './panelcfg.gen';

export type BoxplotFieldKey = keyof BoxplotFieldMap;

export interface BoxFieldInfo {
  /** property name on BoxplotFieldMap */
  key: BoxplotFieldKey;
  /** display name shown in the field picker */
  name: string;
  /** lowercased field names that auto-map to this dimension */
  defaults: string[];
  /** how the dimension is used */
  description: string;
}

/** Field-picker metadata + auto-detection aliases (includes names emitted by the Reduce transformation). */
export const getBoxplotFieldsInfo = (): Record<BoxplotFieldKey, BoxFieldInfo> => ({
  min: {
    key: 'min',
    name: t('boxplot.name-min', 'Minimum'),
    defaults: ['min', 'minimum', 'p0', 'lower'],
    description: t('boxplot.description-min', 'Lowest value. Drawn as an outlier when a lower whisker is mapped.'),
  },
  q1: {
    key: 'q1',
    name: t('boxplot.name-q1', 'Lower quartile (Q1)'),
    defaults: ['q1', 'p25', '25%', '25th %', 'lower quartile'],
    description: t('boxplot.description-q1', 'First quartile (25th percentile). Lower edge of the box.'),
  },
  median: {
    key: 'median',
    name: t('boxplot.name-median', 'Median'),
    defaults: ['median', 'q2', 'p50', '50%', '50th %'],
    description: t('boxplot.description-median', 'Median (50th percentile). Line inside the box.'),
  },
  q3: {
    key: 'q3',
    name: t('boxplot.name-q3', 'Upper quartile (Q3)'),
    defaults: ['q3', 'p75', '75%', '75th %', 'upper quartile'],
    description: t('boxplot.description-q3', 'Third quartile (75th percentile). Upper edge of the box.'),
  },
  max: {
    key: 'max',
    name: t('boxplot.name-max', 'Maximum'),
    defaults: ['max', 'maximum', 'p100', 'upper'],
    description: t('boxplot.description-max', 'Highest value. Drawn as an outlier when an upper whisker is mapped.'),
  },
  lowerWhisker: {
    key: 'lowerWhisker',
    name: t('boxplot.name-lower-whisker', 'Lower whisker'),
    defaults: ['lowerwhisker', 'lower whisker', 'lower_whisker', 'whiskerlow', 'wlo'],
    description: t('boxplot.description-lower-whisker', 'Optional lower whisker end. Enables outliers below it.'),
  },
  upperWhisker: {
    key: 'upperWhisker',
    name: t('boxplot.name-upper-whisker', 'Upper whisker'),
    defaults: ['upperwhisker', 'upper whisker', 'upper_whisker', 'whiskerhigh', 'whi'],
    description: t('boxplot.description-upper-whisker', 'Optional upper whisker end. Enables outliers above it.'),
  },
});

/** A single box on the category axis, derived from one data row. */
export interface BoxRow {
  category: string;
  color: string;
  q1: number;
  median: number;
  q3: number;
  whiskerLo: number;
  whiskerHi: number;
  outlierLo?: number;
  outlierHi?: number;
  /** Mapped values present for this row, for the tooltip. */
  values: Partial<Record<BoxplotFieldKey, number>>;
}

export interface BoxplotData {
  rows: BoxRow[];
  categories: string[];
  yMin: number;
  yMax: number;
  /** Resolved display name per mapped dimension. */
  names: BoxplotFieldMap;
  /** Value field used for y-axis scale/formatting. */
  valueField?: Field;
  display?: DisplayProcessor;
  warn?: string;
}

const numberOrUndef = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function findFieldOrAuto(frame: DataFrame, info: BoxFieldInfo, fieldMap: BoxplotFieldMap): Field | undefined {
  const mapped = findField(frame, fieldMap[info.key]);
  if (mapped) {
    return mapped;
  }
  for (const field of frame.fields) {
    if (field.type !== FieldType.number) {
      continue;
    }
    const name = getFieldDisplayName(field, frame).toLowerCase();
    if (info.defaults.includes(name) || info.defaults.includes(field.name.toLowerCase())) {
      return field;
    }
  }
  return undefined;
}

/**
 * Resolve which fields drive each box-plot dimension and emit one BoxRow per data row.
 * The panel only draws what the data provides — no statistics are computed here.
 */
export function prepBoxplotData(
  series: DataFrame[] | undefined,
  fieldMap: BoxplotFieldMap | undefined,
  theme: GrafanaTheme2
): BoxplotData {
  if (!series?.length || series.every((f) => f.length === 0)) {
    return { rows: [], categories: [], yMin: 0, yMax: 0, names: {}, warn: '' };
  }

  // A freshly added panel has no `fields` option set yet.
  const map = fieldMap ?? {};

  cacheFieldDisplayNames(series);

  // One box per row, so use the first non-empty frame.
  const frame = series.find((f) => f.length > 0)!;
  setClassicPaletteIdxs([frame], theme, 0);

  const info = getBoxplotFieldsInfo();
  const resolved: Partial<Record<BoxplotFieldKey, Field>> = {};
  const names: BoxplotFieldMap = {};
  for (const dim of Object.values(info)) {
    const field = findFieldOrAuto(frame, dim, map);
    if (field) {
      resolved[dim.key] = field;
      names[dim.key] = getFieldDisplayName(field, frame);
    }
  }

  const { q1, median, q3 } = resolved;
  if (!q1 || !median || !q3) {
    return {
      rows: [],
      categories: [],
      yMin: 0,
      yMax: 0,
      names,
      warn: t(
        'boxplot.warn.missing-fields',
        'Map fields (at least Q1, median, and Q3), or add a Reduce transformation'
      ),
    };
  }

  // Category axis: first string field, else first time field, else row index.
  const categoryField =
    frame.fields.find((f) => f.type === FieldType.string) ?? frame.fields.find((f) => f.type === FieldType.time);

  const valueField = median;
  const color = getFieldSeriesColor(valueField, theme).color;

  const rows: BoxRow[] = [];
  const categories: string[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;

  for (let i = 0; i < frame.length; i++) {
    const q1v = numberOrUndef(q1.values[i]);
    const medianv = numberOrUndef(median.values[i]);
    const q3v = numberOrUndef(q3.values[i]);
    if (q1v == null || medianv == null || q3v == null) {
      continue;
    }

    const minv = numberOrUndef(resolved.min?.values[i]);
    const maxv = numberOrUndef(resolved.max?.values[i]);
    const lwv = numberOrUndef(resolved.lowerWhisker?.values[i]);
    const uwv = numberOrUndef(resolved.upperWhisker?.values[i]);

    const whiskerLo = lwv ?? minv ?? q1v;
    const whiskerHi = uwv ?? maxv ?? q3v;
    // min/max become outliers only when they fall strictly outside a (separately mapped) whisker.
    const outlierLo = minv != null && minv < whiskerLo ? minv : undefined;
    const outlierHi = maxv != null && maxv > whiskerHi ? maxv : undefined;

    const values: BoxRow['values'] = { q1: q1v, median: medianv, q3: q3v };
    if (minv != null) {
      values.min = minv;
    }
    if (maxv != null) {
      values.max = maxv;
    }
    if (lwv != null) {
      values.lowerWhisker = lwv;
    }
    if (uwv != null) {
      values.upperWhisker = uwv;
    }

    const category = categoryField
      ? String(categoryField.display?.(categoryField.values[i]).text ?? categoryField.values[i] ?? i + 1)
      : String(i + 1);

    rows.push({
      category,
      color,
      q1: q1v,
      median: medianv,
      q3: q3v,
      whiskerLo,
      whiskerHi,
      outlierLo,
      outlierHi,
      values,
    });
    categories.push(category);

    yMin = Math.min(yMin, outlierLo ?? whiskerLo);
    yMax = Math.max(yMax, outlierHi ?? whiskerHi);
  }

  if (rows.length === 0) {
    return { rows, categories, yMin: 0, yMax: 0, names, valueField, display: valueField.display };
  }

  return { rows, categories, yMin, yMax, names, valueField, display: valueField.display };
}
