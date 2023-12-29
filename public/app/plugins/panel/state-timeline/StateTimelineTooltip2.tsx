import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  Field,
  FieldType,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
  TimeZone,
} from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
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
}

export const StateTimelineTooltip2 = ({
  data,
  alignedData,
  dataIdxs,
  seriesIdx,
  timeZone,
  isPinned,
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

  const field = alignedData.fields[seriesIdx!];

  const links: Array<LinkModel<Field>> = getDataLinks(field, datapointIdx);

  const xField = alignedData.fields[0];
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });

  const dataFrameFieldIndex = field.state?.origin;
  const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
  const value = field.values[datapointIdx!];
  const display = fieldFmt(value);
  const fieldDisplayName = dataFrameFieldIndex
    ? getFieldDisplayName(
        data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex],
        data[dataFrameFieldIndex.frameIndex],
        data
      )
    : null;

  const nextStateIdx = findNextStateIndex(field, datapointIdx!);
  let nextStateTs;
  if (nextStateIdx) {
    nextStateTs = xField.values[nextStateIdx!];
  }

  const stateTs = xField.values[datapointIdx!];
  let duration = nextStateTs && fmtDuration(nextStateTs - stateTs);

  if (nextStateTs) {
    duration = nextStateTs && fmtDuration(nextStateTs - stateTs);
  }

  const from = xFieldFmt(xField.values[datapointIdx!]).text;
  const to = xFieldFmt(xField.values[nextStateIdx!]).text;

  const getHeaderLabel = (): LabelValue => {
    return {
      label: '',
      value: Boolean(to) ? to : from,
    };
  };

  const getContentLabelValue = (): LabelValue[] => {
    const durationEntry: LabelValue[] = duration ? [{ label: 'Duration', value: duration }] : [];

    return [
      {
        label: fieldDisplayName ?? '',
        value: display.text,
        color: display.color,
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
      },
      ...durationEntry,
    ];
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} />
      <VizTooltipContent contentLabelValue={getContentLabelValue()} />
      {isPinned && <VizTooltipFooter dataLinks={links} canAnnotate={false} />}
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
