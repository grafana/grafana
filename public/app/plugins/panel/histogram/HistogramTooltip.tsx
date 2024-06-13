import { css } from '@emotion/css';
import React, { ReactNode, useMemo } from 'react';

import { DataFrame, formattedValueToString } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';
import { getContentItems } from '@grafana/ui/src/components/VizTooltip/utils';

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
  const styles = useStyles2(getStyles);

  const xMinField = series.fields[0];
  const xMaxField = series.fields[1];

  const xMinVal = formattedValueToString(
    !xMinField.config.unit && xMaxField.config.unit
      ? xMaxField.display!(xMinField.values[dataIdxs[0]!])
      : xMinField.display!(xMinField.values[dataIdxs[0]!])
  );
  const xMaxVal = formattedValueToString(
    !xMaxField.config.unit && xMinField.config.unit
      ? xMinField.display!(xMaxField.values[dataIdxs[1]!])
      : xMaxField.display!(xMaxField.values[dataIdxs[1]!])
  );

  const headerItem: VizTooltipItem | null = xMinField.config.custom?.hideFrom?.tooltip
    ? null
    : {
        label: `Bucket ${xMinVal} - ${xMaxVal}`,
        value: '',
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
    <div className={styles.wrapper}>
      {headerItem != null && <VizTooltipHeader item={headerItem} isPinned={isPinned} />}
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      />
      {footer}
    </div>
  );
};

export const getStyles = () => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
});
