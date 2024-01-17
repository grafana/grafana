import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  Field,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  TimeZone,
  LinkModel,
  FieldType,
  arrayUtils,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, ColorPlacement, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';

import { getDataLinks } from './utils';

interface StatusHistoryTooltipProps {
  data: DataFrame[];
  dataIdxs: Array<number | null>;
  alignedData: DataFrame;
  seriesIdx: number | null | undefined;
  timeZone: TimeZone;
  isPinned: boolean;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;
  annotate?: () => void;
}

function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }

  return `${val}`;
}

export const StatusHistoryTooltip2 = ({
  dataIdxs,
  alignedData,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
}: StatusHistoryTooltipProps) => {
  const styles = useStyles2(getStyles);

  const datapointIdx = seriesIdx != null ? dataIdxs[seriesIdx] : dataIdxs.find((idx) => idx != null);

  if (datapointIdx == null || seriesIdx == null) {
    return null;
  }

  let contentLabelValue: LabelValue[] = [];

  const xField = alignedData.fields[0];
  let links: Array<LinkModel<Field>> = [];

  // Single mode
  if (mode === TooltipDisplayMode.Single || isPinned) {
    const field = alignedData.fields[seriesIdx!];
    links = getDataLinks(field, datapointIdx);

    const fieldFmt = field.display || getDisplayProcessor();
    const value = field.values[datapointIdx!];
    const display = fieldFmt(value);

    contentLabelValue = [
      {
        label: getFieldDisplayName(field),
        value: fmt(field, field.values[datapointIdx]),
        color: display.color,
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
      },
    ];
  }

  if (mode === TooltipDisplayMode.Multi && !isPinned) {
    const frame = alignedData;
    const fields = frame.fields;
    const sortIdx: unknown[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = frame.fields[i];
      if (
        !field ||
        field === xField ||
        field.type === FieldType.time ||
        field.config.custom?.hideFrom?.tooltip ||
        field.config.custom?.hideFrom?.viz
      ) {
        continue;
      }

      const fieldFmt = field.display || getDisplayProcessor();
      const v = field.values[datapointIdx!];
      const display = fieldFmt(v);

      sortIdx.push(v);
      contentLabelValue.push({
        label: getFieldDisplayName(field),
        value: fmt(field, field.values[datapointIdx]),
        color: display.color,
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
        isActive: seriesIdx === i,
      });
    }

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

  const getHeaderLabel = (): LabelValue => {
    return {
      label: '',
      value: fmt(xField, xField.values[datapointIdx]),
    };
  };

  const getContentLabelValue = () => {
    return contentLabelValue;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} isPinned={isPinned} />
      <VizTooltipContent contentLabelValue={getContentLabelValue()} isPinned={isPinned} />
      {isPinned && <VizTooltipFooter dataLinks={links} annotate={annotate} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
  }),
});
