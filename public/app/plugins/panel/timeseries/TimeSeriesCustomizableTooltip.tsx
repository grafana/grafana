import { ReactNode } from 'react';

import { DataFrame, Field, FieldType, InterpolateFunction, LinkModel } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipWrapper } from '@grafana/ui/src/components/VizTooltip/VizTooltipWrapper';
import { getContentItems } from '@grafana/ui/src/components/VizTooltip/utils';

import { fmt } from '../xychart/utils';

import { isTooltipScrollable } from './utils';

export interface TimeSeriesCustomizableTooltipProps {
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

  maxHeight?: number;

  replaceVariables?: InterpolateFunction;
  dataLinks: LinkModel[];
  hideZeros?: boolean;

  customHeader?: ReactNode;
  customFooter?: ReactNode;
}

export const TimeSeriesCustomizableTooltip = ({
  series,
  _rest,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  maxHeight,
  hideZeros,
  customHeader,
  customFooter,
}: TimeSeriesCustomizableTooltipProps) => {
  const xField = series.fields[0];

  /* contentItems = {
    "label": "A-series",
    "value": "66.5",
    "color": "#73BF69",
    "colorIndicator": "series",
    "colorPlacement": "first",
    "isActive": false,
    "numeric": 66.487167363726
     */
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

  return (
    <VizTooltipWrapper>
      {customHeader}
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      />
      {customFooter}
    </VizTooltipWrapper>
  );
};
