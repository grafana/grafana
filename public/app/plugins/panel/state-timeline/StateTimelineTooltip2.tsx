import { css } from '@emotion/css';
import React from 'react';

import {
  arrayUtils,
  DataFrame,
  Field,
  FieldType,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { SortOrder } from '@grafana/schema/dist/esm/common/common.gen';
import { TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, ColorPlacement, LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { DEFAULT_TOOLTIP_WIDTH } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { findNextStateIndex, fmtDuration } from 'app/core/components/TimelineChart/utils';

import { getDataLinks } from '../status-history/utils';

interface StateTimelineTooltip2Props {
  data: DataFrame[];
  alignedData: DataFrame;
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  isPinned: boolean;
  timeZone?: TimeZone;
  timeRange: TimeRange;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;
  annotate?: () => void;
}

export const StateTimelineTooltip2 = ({
  data,
  alignedData,
  dataIdxs,
  seriesIdx,
  timeZone,
  timeRange,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
}: StateTimelineTooltip2Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const datapointIdx = seriesIdx != null ? dataIdxs[seriesIdx] : dataIdxs.find((idx) => idx != null);

  if (datapointIdx == null || seriesIdx == null) {
    return null;
  }

  const valueFieldsCount = data.reduce(
    (acc, frame) => acc + frame.fields.filter((field) => field.type !== FieldType.time).length,
    0
  );

  /**
   * There could be a case when the tooltip shows a data from one of a multiple query and the other query finishes first
   * from refreshing. This causes data to be out of sync. alignedData - 1 because Time field doesn't count.
   * Render nothing in this case to prevent error.
   * See https://github.com/grafana/support-escalations/issues/932
   */
  if (
    (!alignedData.meta?.transformations?.length && alignedData.fields.length - 1 !== valueFieldsCount) ||
    !alignedData.fields[seriesIdx]
  ) {
    return null;
  }

  let contentLabelValue: LabelValue[] = [];

  const xField = alignedData.fields[0];
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  let links: Array<LinkModel<Field>> = [];

  const from = xFieldFmt(xField.values[datapointIdx!]).text;

  // Single mode
  if (mode === TooltipDisplayMode.Single || isPinned) {
    const field = alignedData.fields[seriesIdx!];
    links = getDataLinks(field, datapointIdx);

    const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
    const value = field.values[datapointIdx!];
    const display = fieldFmt(value);

    const nextStateIdx = findNextStateIndex(field, datapointIdx!);
    let nextStateTs;
    if (nextStateIdx) {
      nextStateTs = xField.values[nextStateIdx!];
    }

    const stateTs = xField.values[datapointIdx!];
    let duration: string;

    if (nextStateTs) {
      duration = nextStateTs && fmtDuration(nextStateTs - stateTs);
    } else {
      const to = timeRange.to.valueOf();
      duration = fmtDuration(to - stateTs);
    }

    const durationEntry: LabelValue[] = duration ? [{ label: 'Duration', value: duration }] : [];

    contentLabelValue = [
      {
        label: getFieldDisplayName(field),
        value: display.text,
        color: display.color,
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
      },
      ...durationEntry,
    ];
  }

  if (mode === TooltipDisplayMode.Multi && !isPinned) {
    const fields = alignedData.fields;
    const sortIdx: unknown[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (
        !field ||
        field === xField ||
        field.type === FieldType.time ||
        field.config.custom?.hideFrom?.tooltip ||
        field.config.custom?.hideFrom?.viz
      ) {
        continue;
      }

      const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
      const v = field.values[dataIdxs[i]!];
      const display = fieldFmt(v);

      sortIdx.push(v);
      contentLabelValue.push({
        label: getFieldDisplayName(field),
        value: display.text,
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
      value: from,
    };
  };

  const getContentLabelValue = (): LabelValue[] => {
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
    width: DEFAULT_TOOLTIP_WIDTH,
  }),
});
