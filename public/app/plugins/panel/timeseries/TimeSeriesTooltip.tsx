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
  arrayUtils,
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

  annotate?: () => void;
}

export const TimeSeriesTooltip = ({
  frames,
  seriesFrame,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
}: TimeSeriesTooltipProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const xField = seriesFrame.fields[0];
  if (!xField) {
    return null;
  }

  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, theme });
  let xVal = xFieldFmt(xField!.values[dataIdxs[0]!]).text;

  let links: Array<LinkModel<Field>> = [];
  let contentLabelValue: LabelValue[] = [];

  // Single mode
  if (mode === TooltipDisplayMode.Single) {
    const field = seriesFrame.fields[seriesIdx!];
    if (!field) {
      return null;
    }

    const dataIdx = dataIdxs[seriesIdx!]!;
    xVal = xFieldFmt(xField!.values[dataIdx]).text;
    const fieldFmt = field.display || getDisplayProcessor({ field, theme });
    const display = fieldFmt(field.values[dataIdx]);

    links = getDataLinks(field, dataIdx);

    contentLabelValue = [
      {
        label: getFieldDisplayName(field, seriesFrame, frames),
        value: display ? formattedValueToString(display) : null,
        color: display.color || FALLBACK_COLOR,
        colorIndicator: ColorIndicator.series,
        colorPlacement: ColorPlacement.first,
      },
    ];
  }

  if (mode === TooltipDisplayMode.Multi) {
    const fields = seriesFrame.fields;
    const sortIdx: unknown[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = seriesFrame.fields[i];
      if (
        !field ||
        field === xField ||
        field.type === FieldType.time ||
        field.type !== FieldType.number ||
        field.config.custom?.hideFrom?.tooltip ||
        field.config.custom?.hideFrom?.viz
      ) {
        continue;
      }

      const v = seriesFrame.fields[i].values[dataIdxs[i]!];
      const display = field.display!(v); // super expensive :(

      sortIdx.push(v);
      contentLabelValue.push({
        label: field.state?.displayName ?? field.name,
        value: display ? formattedValueToString(display) : null,
        color: display.color || FALLBACK_COLOR,
        colorIndicator: ColorIndicator.series,
        colorPlacement: ColorPlacement.first,
        isActive: seriesIdx === i,
      });

      if (sortOrder !== SortOrder.None) {
        // create sort reference series array, as Array.sort() mutates the original array
        const sortRef = [...contentLabelValue];
        const sortFn = arrayUtils.sortValues(sortOrder);

        contentLabelValue.sort((a, b) => {
          // get compared values indices to retrieve raw values from sortIdx
          const aIdx = sortRef.indexOf(a);
          const bIdx = sortRef.indexOf(b);
          return sortFn(sortIdx[aIdx], sortIdx[bIdx]);
        });
      }
    }

    if (seriesIdx != null) {
      const field = seriesFrame.fields[seriesIdx];
      const dataIdx = dataIdxs[seriesIdx]!;
      links = getDataLinks(field, dataIdx);
    }
  }

  const getHeaderLabel = (): LabelValue => {
    return {
      label: xField.type === FieldType.time ? '' : getFieldDisplayName(xField, seriesFrame, frames),
      value: xVal,
    };
  };

  const getContentLabelValue = () => {
    return contentLabelValue;
  };

  return (
    <div>
      <div className={styles.wrapper}>
        <VizTooltipHeader headerLabel={getHeaderLabel()} isPinned={isPinned} />
        <VizTooltipContent
          contentLabelValue={getContentLabelValue()}
          isPinned={isPinned}
          scrollable={mode === TooltipDisplayMode.Multi}
        />
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
