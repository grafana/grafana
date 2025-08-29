import { ReactNode } from 'react';

import {
  DataFrame,
  dateTime,
  Field,
  FieldType,
  formattedValueToString,
  InterpolateFunction,
  LinkModel,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  getContentItems,
  VizTooltipItem,
  AdHocFilterModel,
} from '@grafana/ui/internal';

import { getFieldActions } from '../status-history/utils';

import { isTooltipScrollable } from './utils';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

export interface TimeSeriesTooltipProps {
  // aligned series frame
  series: DataFrame;

  // aligned fields that are not series
  _rest?: Field[];

  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;

  isPinned: boolean;

  annotate?: () => void;
  maxHeight?: number;

  replaceVariables?: InterpolateFunction;
  dataLinks: LinkModel[];
  hideZeros?: boolean;
  adHocFilters?: AdHocFilterModel[];
}
function getTooltipTimeText(timestamp: number, field: Field) {
  const tc = field.config.custom?.timeCompare;
  if (tc?.isTimeShiftQuery) {
    timestamp += tc.diffMs;
  }
  return dateTime(timestamp).utc().format('YYYY-MM-DD HH:mm:ss');
}
export const TimeSeriesTooltip = ({
  series,
  _rest,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
  maxHeight,
  replaceVariables = (str) => str,
  dataLinks,
  hideZeros,
  adHocFilters,
}: TimeSeriesTooltipProps) => {
  const xField = series.fields[0];
  let timestamp = xField.values[dataIdxs[0]!];
  const hoveredField = series.fields[seriesIdx ?? 1];
  const xVal =
    xField.type === FieldType.time
      ? getTooltipTimeText(timestamp, hoveredField)
      : formattedValueToString(xField.display!(timestamp));

  const contentItems = getContentItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    mode,
    sortOrder,
    (field) => field.type === FieldType.number || field.type === FieldType.enum,
    hideZeros,
    _rest
  );

  let footer: ReactNode;

  if (seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const hasOneClickLink = dataLinks.some((dataLink) => dataLink.oneClick === true);

    if (isPinned || hasOneClickLink) {
      const dataIdx = dataIdxs[seriesIdx]!;
      const actions = getFieldActions(series, field, replaceVariables, dataIdx);

      footer = (
        <VizTooltipFooter dataLinks={dataLinks} actions={actions} annotate={annotate} adHocFilters={adHocFilters} />
      );
    }
  }

  const headerItem: VizTooltipItem = {
    label: xField.type === FieldType.time ? '' : (xField.state?.displayName ?? xField.name),
    value: xVal,
  };

  return (
    <VizTooltipWrapper>
      {headerItem != null && <VizTooltipHeader item={headerItem} isPinned={isPinned} />}
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
