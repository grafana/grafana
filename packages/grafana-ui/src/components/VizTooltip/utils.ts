import { FALLBACK_COLOR, Field, FieldType, formattedValueToString, getFieldColorModeForField } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { ColorIndicatorStyles } from './VizTooltipColorIndicator';
import { ColorIndicator, ColorPlacement, VizTooltipItem } from './types';

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

export const getContentItems = (
  fields: Field[],
  xField: Field,
  dataIdxs: Array<number | null>,
  seriesIdx: number | null | undefined,
  mode: TooltipDisplayMode,
  sortOrder: SortOrder,
  fieldFilter = (field: Field) => true,
  hideZeros = false
): VizTooltipItem[] => {
  let rows: VizTooltipItem[] = [];

  let allNumeric = true;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    if (
      field === xField ||
      field.type === FieldType.time ||
      !fieldFilter(field) ||
      field.config.custom?.hideFrom?.tooltip ||
      field.config.custom?.hideFrom?.viz
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

    const display = field.display!(v); // super expensive :(

    // sort NaN and non-numeric to bottom (regardless of sort order)
    const numeric = !Number.isNaN(display.numeric)
      ? display.numeric
      : sortOrder === SortOrder.Descending
        ? Number.MIN_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;

    const colorMode = getFieldColorModeForField(field);

    let colorIndicator = ColorIndicator.series;
    let colorPlacement = ColorPlacement.first;

    if (colorMode.isByValue) {
      colorIndicator = ColorIndicator.value;
      colorPlacement = ColorPlacement.trailing;
    }

    rows.push({
      label: field.state?.displayName ?? field.name,
      value: formattedValueToString(display),
      color: display.color ?? FALLBACK_COLOR,
      colorIndicator,
      colorPlacement,
      isActive: mode === TooltipDisplayMode.Multi && seriesIdx === i,
      numeric,
      lineStyle: field.config.custom?.lineStyle,
    });
  }

  if (sortOrder !== SortOrder.None && rows.length > 1) {
    const cmp = allNumeric ? numberCmp : stringCmp;
    const mult = sortOrder === SortOrder.Descending ? -1 : 1;
    rows.sort((a, b) => mult * cmp(a, b));
  }

  return rows;
};
