import {
  FALLBACK_COLOR,
  type Field,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  type LinkModel,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { type ColorIndicatorStyles } from './VizTooltipColorIndicator';
import { ColorIndicator, ColorPlacement, type VizTooltipItem } from './types';

export const calculateTooltipPosition = (
  xPos = 0,
  yPos = 0,
  tooltipWidth = 0,
  tooltipHeight = 0,
  xOffset = 0,
  yOffset = 0,
  windowWidth = 0,
  windowHeight = 0
) => {
  let x = xPos;
  let y = yPos;

  const overflowRight = Math.max(xPos + xOffset + tooltipWidth - (windowWidth - xOffset), 0);
  const overflowLeft = Math.abs(Math.min(xPos - xOffset - tooltipWidth - xOffset, 0));
  const wouldOverflowRight = overflowRight > 0;
  const wouldOverflowLeft = overflowLeft > 0;

  const overflowBelow = Math.max(yPos + yOffset + tooltipHeight - (windowHeight - yOffset), 0);
  const overflowAbove = Math.abs(Math.min(yPos - yOffset - tooltipHeight - yOffset, 0));
  const wouldOverflowBelow = overflowBelow > 0;
  const wouldOverflowAbove = overflowAbove > 0;

  if (wouldOverflowRight && wouldOverflowLeft) {
    x = overflowRight > overflowLeft ? xOffset : windowWidth - xOffset - tooltipWidth;
  } else if (wouldOverflowRight) {
    x = xPos - xOffset - tooltipWidth;
  } else {
    x = xPos + xOffset;
  }

  if (wouldOverflowBelow && wouldOverflowAbove) {
    y = overflowBelow > overflowAbove ? yOffset : windowHeight - yOffset - tooltipHeight;
  } else if (wouldOverflowBelow) {
    y = yPos - yOffset - tooltipHeight;
  } else {
    y = yPos + yOffset;
  }
  return { x, y };
};

export const getColorIndicatorClass = (colorIndicator: string, styles: ColorIndicatorStyles) => {
  switch (colorIndicator) {
    case ColorIndicator.series:
      return styles.series;
    case ColorIndicator.value:
      return styles.value;
    case ColorIndicator.hexagon:
      return styles.hexagon;
    case ColorIndicator.pie_1_4:
      return styles.pie_1_4;
    case ColorIndicator.pie_2_4:
      return styles.pie_2_4;
    case ColorIndicator.pie_3_4:
      return styles.pie_3_4;
    case ColorIndicator.marker_sm:
      return styles.marker_sm;
    case ColorIndicator.marker_md:
      return styles.marker_md;
    case ColorIndicator.marker_lg:
      return styles.marker_lg;
    default:
      return styles.value;
  }
};

const numberCmp = (a: VizTooltipItem, b: VizTooltipItem) => a.numeric! - b.numeric!;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const stringCmp = (a: VizTooltipItem, b: VizTooltipItem) => collator.compare(`${a.value}`, `${b.value}`);

export const getTooltipDisplayValue = (
  value: unknown,
  field: Field
): {
  text: string;
  numeric: number;
  color?: string;
} => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { text: '', numeric: NaN };
    }

    return { text: JSON.stringify(value), numeric: NaN };
  }

  if (value && typeof value === 'object') {
    return { text: JSON.stringify(value), numeric: NaN };
  }

  const display = field.display!(value); // super expensive :(
  return { text: formattedValueToString(display), numeric: display.numeric, color: display.color };
};

/**
 * Builds the list of {@link VizTooltipItem} rows to display in a visualization tooltip.
 *
 * @param fields - All fields in the aligned data frame (including the x/time field).
 * @param xField - The x-axis or time field; it is excluded from the output rows.
 * @param dataIdxs - Per-field data row indices for the hovered point. A `null` entry means that field has no hovered value and is omitted.
 * @param seriesIdx - Index of the closest/hovered series. In `Single` mode only this series is shown; in `Multi` mode it controls the `isActive` highlight.
 * @param mode - Whether to show only the hovered series (`Single`) or all series (`Multi`).
 * @param sortOrder - How to sort the output rows. Use `SortOrder.None` to preserve field order.
 * @param fieldFilter - Optional predicate to exclude specific fields. Defaults to including all fields.
 * @param hideZeros - When `true`, rows whose value is exactly `0` are omitted.
 * @param extraFields - Additional fields appended after the main rows as supplementary context (e.g. fields not shown in the visualization). These rows have `isHiddenFromViz: true` and are not sorted.
 */
export const getFieldDisplayItems = (
  fields: Field[],
  xField: Field,
  dataIdxs: Array<number | null>,
  seriesIdx: number | null | undefined,
  mode: TooltipDisplayMode,
  sortOrder: SortOrder,
  fieldFilter = (field: Field) => true,
  hideZeros = false,
  extraFields?: Field[]
): VizTooltipItem[] => {
  let rows: VizTooltipItem[] = [];

  let allNumeric = true;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    if (
      field === xField ||
      field.type === FieldType.time ||
      !fieldFilter(field) ||
      field.config.custom?.hideFrom?.tooltip
    ) {
      continue;
    }

    // in single mode, skip all but closest field
    if (mode === TooltipDisplayMode.Single && seriesIdx !== i) {
      continue;
    }

    let dataIdx = dataIdxs[i];

    // omit non-hovered
    if (dataIdx == null) {
      continue;
    }

    if (!(field.type === FieldType.number || field.type === FieldType.boolean || field.type === FieldType.enum)) {
      allNumeric = false;
    }

    const v = fields[i].values[dataIdx];

    if ((v == null && field.config.noValue == null) || (hideZeros && v === 0)) {
      continue;
    }

    const display = getTooltipDisplayValue(v, field);

    // sort NaN and non-numeric to bottom (regardless of sort order)
    const numeric = !Number.isNaN(display.numeric)
      ? display.numeric
      : sortOrder === SortOrder.Descending
        ? Number.MIN_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;

    const { colorIndicator, colorPlacement } = getIndicatorAndPlacement(field);

    rows.push({
      label: field.state?.displayName ?? field.name,
      value: display.text,
      color: display.color ?? FALLBACK_COLOR,
      colorIndicator,
      colorPlacement,
      isActive: mode === TooltipDisplayMode.Multi && seriesIdx === i,
      numeric,
      lineStyle: field.config.custom?.lineStyle,
    });
  }

  extraFields?.forEach((field) => {
    if (!field.config.custom?.hideFrom?.tooltip) {
      const { colorIndicator, colorPlacement } = getIndicatorAndPlacement(field);
      const rawValue = field.values[dataIdxs[0]!];
      const display = getTooltipDisplayValue(rawValue, field);

      rows.push({
        label: field.state?.displayName ?? field.name,
        value: display.text,
        color: FALLBACK_COLOR,
        colorIndicator,
        colorPlacement,
        lineStyle: field.config.custom?.lineStyle,
        isHiddenFromViz: true,
      });
    }
  });

  if (sortOrder !== SortOrder.None && rows.length > 1) {
    const cmp = allNumeric ? numberCmp : stringCmp;
    const mult = sortOrder === SortOrder.Descending ? -1 : 1;
    rows.sort((a, b) => mult * cmp(a, b));
  }

  return rows;
};

/**
 * Returns the resolved data links for a specific data point in a field.
 *
 * Deduplicates links by `title/href` so that the same link target is not shown
 * twice when multiple override rules produce identical links.
 *
 * @param field - The field containing the data point and its link configuration.
 * @param rowIdx - The row index of the hovered data point within `field.values`.
 */
export const getFieldDisplayLinks = (field: Field, rowIdx: number): Array<LinkModel<Field>> => {
  const links: Array<LinkModel<Field>> = [];

  if ((field.config.links?.length ?? 0) > 0 && field.getLinks != null) {
    const v = field.values[rowIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
    const linkLookup = new Set<string>();

    field.getLinks({ calculatedValue: disp, valueRowIndex: rowIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  return links;
};

const getIndicatorAndPlacement = (field: Field) => {
  const colorMode = getFieldColorModeForField(field);

  let colorIndicator = ColorIndicator.series;
  let colorPlacement = ColorPlacement.first;

  if (colorMode.isByValue) {
    colorIndicator = ColorIndicator.value;
    colorPlacement = ColorPlacement.trailing;
  }

  return { colorIndicator, colorPlacement };
};
