import { ReactNode } from 'react';

import { FieldType, TimeRange, usePluginContext } from '@grafana/data';
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

interface StateTimelineTooltipProps extends TimeSeriesTooltipProps {
  timeRange: TimeRange;
  withDuration: boolean;
}

export const StateTimelineTooltip = ({
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
}: StateTimelineTooltipProps) => {
  const pluginContext = usePluginContext();
  const xField = series.fields[0];

  const dataIdx = seriesIdx != null ? dataIdxs[seriesIdx] : dataIdxs.find((idx) => idx != null);

  const xVal = xField.display!(xField.values[dataIdx!]).text;

  mode = isPinned ? TooltipDisplayMode.Single : mode;

  // Fix for issue #113082: Populate dataIdxs for fields hidden from viz but not from tooltip
  // When a field is hidden from viz (hideFrom.viz=true), uPlot doesn't track cursor for it,
  // resulting in dataIdxs[fieldIndex] = null. We need to populate it manually for tooltip display.
  const enrichedDataIdxs = dataIdxs.map((idx, i) => {
    // If we already have an index for this field, use it
    if (idx != null) {
      return idx;
    }

    // Check if this field is hidden from viz but should show in tooltip
    const field = series.fields[i];
    if (field && field.config.custom?.hideFrom?.viz && !field.config.custom?.hideFrom?.tooltip) {
      // Use the dataIdx from the currently hovered/selected series, or first available
      return dataIdx ?? dataIdxs.find((existingIdx) => existingIdx != null) ?? 0;
    }

    // Field is either hidden from tooltip or not a data field, keep as null
    return idx;
  });

  const contentItems = getContentItems(series.fields, xField, enrichedDataIdxs, seriesIdx, mode, sortOrder);
  let endTime = null;

  // append duration in single mode
  if (withDuration && mode === TooltipDisplayMode.Single) {
    const field = series.fields[seriesIdx!];
    const nextStateIdx = findNextStateIndex(field, dataIdx!);
    let nextStateTs;
    if (nextStateIdx != null) {
      nextStateTs = xField.values[nextStateIdx];
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
      const visualizationType = pluginContext?.meta?.id ?? 'state-timeline';
      const dataIdx = dataIdxs[seriesIdx]!;
      const actions = getFieldActions(series, field, replaceVariables!, dataIdx, visualizationType);

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
