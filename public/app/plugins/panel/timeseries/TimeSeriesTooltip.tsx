import { ReactNode } from 'react';

import { DataFrame, Field, FieldType, formattedValueToString, InterpolateFunction, LinkModel } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { VizTooltipWrapper } from '@grafana/ui/src/components/VizTooltip/VizTooltipWrapper';
import { VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';
import { getContentItems } from '@grafana/ui/src/components/VizTooltip/utils';

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
  replaceVariables,
  dataLinks,
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
    (field) => field.type === FieldType.number || field.type === FieldType.enum
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

  if (isPinned && seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const dataIdx = dataIdxs[seriesIdx]!;
    const actions = getFieldActions(series, field, replaceVariables!, dataIdx);

    footer = <VizTooltipFooter dataLinks={dataLinks} actions={actions} annotate={annotate} />;
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
