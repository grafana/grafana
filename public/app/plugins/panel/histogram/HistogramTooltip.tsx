import { ReactNode, useMemo } from 'react';

import { DataFrame, formattedValueToString } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  getContentItems,
  VizTooltipItem,
} from '@grafana/ui/internal';

import { getDataLinks } from '../status-history/utils';
import { isTooltipScrollable } from '../timeseries/utils';

export interface HistogramTooltipProps {
  // aligned series frame
  series: DataFrame;
  xMinOnlyFrame: DataFrame;

  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;

  isPinned: boolean;
  maxHeight?: number;
}

export const HistogramTooltip = ({
  series,
  xMinOnlyFrame,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  maxHeight,
}: HistogramTooltipProps) => {
  const xMinField = series.fields[0];
  const xMaxField = series.fields[1];

  // use the formatter from other bucket bound if none is defined
  const { display: xMinDisp } = xMinField.config.unit != null ? xMinField : xMaxField;
  const { display: xMaxDisp } = xMaxField.config.unit != null ? xMaxField : xMinField;

  const xMinVal = formattedValueToString(xMinDisp!(xMinField.values[dataIdxs[0]!]));
  const xMaxVal = formattedValueToString(xMaxDisp!(xMaxField.values[dataIdxs[1]!]));

  const headerItem: VizTooltipItem = {
    label: 'Bucket',
    value: `${xMinVal} - ${xMaxVal}`,
  };

  const contentItems = useMemo(
    () => getContentItems(xMinOnlyFrame.fields, xMinField, dataIdxs, seriesIdx, mode, sortOrder),
    [xMinOnlyFrame.fields, xMinField, dataIdxs, seriesIdx, mode, sortOrder]
  );

  let footer: ReactNode;

  if (isPinned && seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const dataIdx = dataIdxs[seriesIdx]!;
    const links = getDataLinks(field, dataIdx);

    footer = <VizTooltipFooter dataLinks={links} />;
  }

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
