import React, { ReactNode } from 'react';

import { DataFrame } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { ColorIndicator, VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';

import { getDataLinks } from '../status-history/utils';
import { getStyles } from '../timeseries/TimeSeriesTooltip';

import { XYSeries } from './types2';
import { fmt } from './utils';

export interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  isPinned: boolean;
  dismiss: () => void;
  data: DataFrame[];
  xySeries: XYSeries[];
}

export const XYChartTooltip = ({ dataIdxs, seriesIdx, data, xySeries, dismiss, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  const rowIndex = dataIdxs.find((idx) => idx !== null)!;

  const series = xySeries[seriesIdx! - 1];
  const xField = series.x.field;
  const yField = series.y.field;

  let label = series.name.value;

  let seriesColor = series.color.fixed;
  // let colorField = series.color.field;
  // let pointColor: string;

  // if (colorField != null) {
  //   pointColor = colorField.display?.(colorField.values[rowIndex]).color!;
  // }

  const headerItem: VizTooltipItem = {
    label,
    value: '',
    color: alpha(seriesColor!, 0.5),
    colorIndicator: ColorIndicator.marker_md,
  };

  const contentItems: VizTooltipItem[] = [
    {
      label: xField.state?.displayName ?? xField.name,
      value: fmt(xField, xField.values[rowIndex]),
    },
    {
      label: yField.state?.displayName ?? yField.name,
      value: fmt(yField, yField.values[rowIndex]),
    },
  ];

  series._rest.forEach((field) => {
    contentItems.push({
      label: field.state?.displayName ?? field.name,
      value: fmt(field, field.values[rowIndex]),
    });
  });

  let footer: ReactNode;

  if (isPinned && seriesIdx != null) {
    const links = getDataLinks(yField, rowIndex);

    footer = <VizTooltipFooter dataLinks={links} />;
  }

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent items={contentItems} isPinned={isPinned} />
      {footer}
    </div>
  );
};
