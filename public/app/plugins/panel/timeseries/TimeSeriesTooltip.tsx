import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  FALLBACK_COLOR,
  FieldType,
  formattedValueToString,
  LinkModel,
  Field,
  getFieldDisplayName,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, ColorPlacement, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';

import { getDataLinks } from '../status-history/utils';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

export interface TimeSeriesTooltipProps {
  frames?: DataFrame[];
  // aligned series frame
  seriesFrame: DataFrame;
  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;

  isPinned: boolean;
  scrollable?: boolean;

  annotate?: () => void;
}

const numberCmp = (a: LabelValue, b: LabelValue) => a.numeric! - b.numeric!;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const stringCmp = (a: LabelValue, b: LabelValue) => collator.compare(`${a.value}`, `${b.value}`);

export function getContentItems(
  fields: Field[],
  xField: Field,
  dataIdxs: Array<number | null>,
  seriesIdx: number | null | undefined,
  mode: TooltipDisplayMode,
  sortOrder: SortOrder,
  fieldFilter = (field: Field) => true
) {
  let rows: LabelValue[] = [];

  let allNumeric = false;

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

    // no value -> zero?
    const display = field.display!(v); // super expensive :(
    // sort NaN and non-numeric to bottom (regardless of sort order)
    const numeric = !Number.isNaN(display.numeric)
      ? display.numeric
      : sortOrder === SortOrder.Descending
        ? Number.MIN_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;

    rows.push({
      label: field.state?.displayName ?? field.name,
      value: formattedValueToString(display),
      color: display.color ?? FALLBACK_COLOR,
      colorIndicator: ColorIndicator.series,
      colorPlacement: ColorPlacement.first,
      isActive: mode === TooltipDisplayMode.Multi && seriesIdx === i,
      numeric,
    });
  }

  if (sortOrder !== SortOrder.None && rows.length > 1) {
    const cmp = allNumeric ? numberCmp : stringCmp;
    const mult = sortOrder === SortOrder.Descending ? -1 : 1;
    rows.sort((a, b) => mult * cmp(a, b));
  }

  return rows;
}

export const TimeSeriesTooltip = ({
  frames,
  seriesFrame,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  scrollable = false,
  isPinned,
  annotate,
}: TimeSeriesTooltipProps) => {
  const styles = useStyles2(getStyles);

  const xField = seriesFrame.fields[0];

  const xVal = xField.display!(xField.values[dataIdxs[0]!]).text;

  const contentItems = getContentItems(
    seriesFrame.fields,
    xField,
    dataIdxs,
    seriesIdx,
    mode,
    sortOrder,
    (field) => field.type === FieldType.number
  );

  let links: Array<LinkModel<Field>> = [];

  if (seriesIdx != null) {
    const field = seriesFrame.fields[seriesIdx];
    const dataIdx = dataIdxs[seriesIdx]!;
    links = getDataLinks(field, dataIdx);
  }

  const headerItem: LabelValue = {
    label: xField.type === FieldType.time ? '' : getFieldDisplayName(xField, seriesFrame, frames),
    value: xVal,
  };

  return (
    <div>
      <div className={styles.wrapper}>
        <VizTooltipHeader headerLabel={headerItem} isPinned={isPinned} />
        <VizTooltipContent contentLabelValue={contentItems} isPinned={isPinned} scrollable={scrollable} />
        {isPinned && <VizTooltipFooter dataLinks={links} annotate={annotate} />}
      </div>
    </div>
  );
};

export const getStyles = () => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
});
