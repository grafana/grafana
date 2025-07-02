import { ReactNode } from 'react';

import { FieldType, TimeRange } from '@grafana/data';
import { SortOrder } from '@grafana/schema/dist/esm/common/common.gen';
import { TooltipDisplayMode } from '@grafana/ui';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  getContentItems,
  VizTooltipItem,
} from '@grafana/ui/internal';
import { findNextStateIndex, fmtDuration } from 'app/core/components/TimelineChart/utils';

import { getFieldActions } from '../status-history/utils';
import { TimeSeriesTooltipProps } from '../timeseries/TimeSeriesTooltip';
import { isTooltipScrollable } from '../timeseries/utils';

interface StateTimelineTooltip2Props extends TimeSeriesTooltipProps {
  timeRange: TimeRange;
  withDuration: boolean;
}

export const StateTimelineTooltip2 = ({
  series,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
  timeRange,
  withDuration,
  maxHeight,
  replaceVariables,
  dataLinks,
}: StateTimelineTooltip2Props) => {
  const xField = series.fields[0];

  const dataIdx = seriesIdx != null ? dataIdxs[seriesIdx] : dataIdxs.find((idx) => idx != null);

  const xVal = xField.display!(xField.values[dataIdx!]).text;

  mode = isPinned ? TooltipDisplayMode.Single : mode;

  const contentItems = getContentItems(series.fields, xField, dataIdxs, seriesIdx, mode, sortOrder);
  let endTime = null;

  // append duration in single mode
  if (withDuration && mode === TooltipDisplayMode.Single) {
    const field = series.fields[seriesIdx!];
    const nextStateIdx = findNextStateIndex(field, dataIdx!);
    let nextStateTs;
    if (nextStateIdx) {
      nextStateTs = xField.values[nextStateIdx!];
    }

    const stateTs = xField.values[dataIdx!];
    let duration: string;

    if (nextStateTs) {
      duration = nextStateTs && fmtDuration(nextStateTs - stateTs);
      endTime = nextStateTs;
    } else {
      const to = timeRange.to.valueOf();
      duration = fmtDuration(to - stateTs);
      endTime = to;
    }

    contentItems.push({ label: 'Duration', value: duration });
  }

  let footer: ReactNode;

  if (seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const hasOneClickLink = dataLinks.some((dataLink) => dataLink.oneClick === true);

    if (isPinned || hasOneClickLink) {
      const dataIdx = dataIdxs[seriesIdx]!;
      const actions = getFieldActions(series, field, replaceVariables!, dataIdx);

      footer = <VizTooltipFooter dataLinks={dataLinks} actions={actions} annotate={annotate} />;
    }
  }

  const headerItem: VizTooltipItem = {
    label: xField.type === FieldType.time ? '' : (xField.state?.displayName ?? xField.name),
    value: endTime ? xVal + ' - \n' + xField.display!(endTime).text : xVal,
  };

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      />
      {footer}
    </VizTooltipWrapper>
  );
};
