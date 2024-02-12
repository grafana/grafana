import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  FALLBACK_COLOR,
  FieldType,
  GrafanaTheme2,
  formattedValueToString,
  getDisplayProcessor,
  LinkModel,
  Field,
  getFieldDisplayName,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, ColorPlacement, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';

import { getDataLinks } from '../status-history/utils';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

interface TimeSeriesTooltipProps {
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
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const xField = seriesFrame.fields[0];

  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, theme });
  let xVal = xFieldFmt(xField!.values[dataIdxs[0]!]).text;

  let contentLabelValue: LabelValue[] = [];

  const fields = seriesFrame.fields;

  for (let i = 0; i < fields.length; i++) {
    const field = seriesFrame.fields[i];

    if (
      field === xField ||
      field.type === FieldType.time ||
      field.type !== FieldType.number ||
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

    const v = seriesFrame.fields[i].values[dataIdx];

    // no value -> zero?
    const display = field.display!(v); // super expensive :(
    // sort NaN and non-numeric to bottom (regardless of sort order)
    const numeric = !Number.isNaN(display.numeric)
      ? display.numeric
      : sortOrder === SortOrder.Descending
        ? Number.MIN_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER;

    contentLabelValue.push({
      label: field.state?.displayName ?? field.name,
      value: formattedValueToString(display),
      color: display.color ?? FALLBACK_COLOR,
      colorIndicator: ColorIndicator.series,
      colorPlacement: ColorPlacement.first,
      isActive: mode === TooltipDisplayMode.Multi && seriesIdx === i,
      numeric,
    });
  }

  if (sortOrder !== SortOrder.None && contentLabelValue.length > 1) {
    let mult = sortOrder === SortOrder.Descending ? -1 : 1;
    contentLabelValue.sort((a, b) => mult * (a.numeric! - b.numeric!));
  }

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
        <VizTooltipContent contentLabelValue={contentLabelValue} isPinned={isPinned} scrollable={scrollable} />
        {isPinned && <VizTooltipFooter dataLinks={links} annotate={annotate} />}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
});
