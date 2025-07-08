import { ReactNode } from 'react';

import { DataFrame, Field, FieldType, formattedValueToString, InterpolateFunction, LinkModel } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { AdHocFilterItem } from '@grafana/ui';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  getContentItems,
  VizTooltipItem,
  FILTER_FOR_OPERATOR,
} from '@grafana/ui/internal';

import { getFieldActions } from '../status-history/utils';
import { fmt } from '../xychart/utils';

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
  onAddAdHocFilter?: (item: AdHocFilterItem) => void;
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
  onAddAdHocFilter,
}: TimeSeriesTooltipProps) => {
  const xField = series.fields[0];
  const xVal = formattedValueToString(xField.display!(xField.values[dataIdxs[0]!]));

  const contentItems = getContentItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    mode,
    sortOrder,
    (field) => field.type === FieldType.number || field.type === FieldType.enum,
    hideZeros
  );

  _rest?.forEach((field) => {
    if (!field.config.custom?.hideFrom?.tooltip) {
      contentItems.push({
        label: field.state?.displayName ?? field.name,
        value: fmt(field, field.values[dataIdxs[0]!]),
      });
    }
  });

  let footer: ReactNode;

  if (seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const hasOneClickLink = dataLinks.some((dataLink) => dataLink.oneClick === true);

    // Check if the field supports filtering (similar to table implementation)
    const showFilters = Boolean(xField.config.filterable && onAddAdHocFilter != null);

    // create the filter click handler based on hovered series index and row index:
    const onFilterClick = showFilters
      ? () => {
          onAddAdHocFilter?.({
            key: xField.name,
            operator: FILTER_FOR_OPERATOR,
            value: String(xField.values[dataIdxs[0]!]),
          });
        }
      : undefined;

    if (isPinned || hasOneClickLink) {
      const dataIdx = dataIdxs[seriesIdx]!;
      const actions = getFieldActions(series, field, replaceVariables, dataIdx);

      footer = (
        <VizTooltipFooter dataLinks={dataLinks} actions={actions} annotate={annotate} onFilterClick={onFilterClick} />
      );
    }
  }

  const headerItem: VizTooltipItem | null = xField.config.custom?.hideFrom?.tooltip
    ? null
    : {
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
