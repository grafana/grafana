import { ReactNode } from 'react';

import { DataFrame, InterpolateFunction, LinkModel } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { VizTooltipWrapper } from '@grafana/ui/src/components/VizTooltip/VizTooltipWrapper';
import { ColorIndicator, VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';

import { getFieldActions } from '../status-history/utils';

import { XYSeries } from './types2';
import { fmt } from './utils';

export interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  isPinned: boolean;
  dismiss: () => void;
  data: DataFrame[];
  xySeries: XYSeries[];
  replaceVariables: InterpolateFunction;
  dataLinks: LinkModel[];
}

function stripSeriesName(fieldName: string, seriesName: string) {
  if (fieldName !== seriesName && fieldName.includes(' ')) {
    fieldName = fieldName.replace(seriesName, '').trim();
  }

  return fieldName;
}

export const XYChartTooltip = ({
  dataIdxs,
  seriesIdx,
  data,
  xySeries,
  dismiss,
  isPinned,
  replaceVariables,
  dataLinks,
}: Props) => {
  const rowIndex = dataIdxs.find((idx) => idx !== null)!;

  const series = xySeries[seriesIdx! - 1];
  const xField = series.x.field;
  const yField = series.y.field;

  const sizeField = series.size.field;
  const colorField = series.color.field;

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
    color: alpha(seriesColor ?? '#fff', 0.5),
    colorIndicator: ColorIndicator.marker_md,
  };

  const contentItems: VizTooltipItem[] = [
    {
      label: stripSeriesName(xField.state?.displayName ?? xField.name, label),
      value: fmt(xField, xField.values[rowIndex]),
    },
    {
      label: stripSeriesName(yField.state?.displayName ?? yField.name, label),
      value: fmt(yField, yField.values[rowIndex]),
    },
  ];

  // mapped fields for size/color
  if (sizeField != null && sizeField !== yField) {
    contentItems.push({
      label: stripSeriesName(sizeField.state?.displayName ?? sizeField.name, label),
      value: fmt(sizeField, sizeField.values[rowIndex]),
    });
  }

  if (colorField != null && colorField !== yField) {
    contentItems.push({
      label: stripSeriesName(colorField.state?.displayName ?? colorField.name, label),
      value: fmt(colorField, colorField.values[rowIndex]),
    });
  }

  series._rest.forEach((field) => {
    contentItems.push({
      label: stripSeriesName(field.state?.displayName ?? field.name, label),
      value: fmt(field, field.values[rowIndex]),
    });
  });

  let footer: ReactNode;

  if (seriesIdx != null) {
    const hasOneClickLink = dataLinks?.some((dataLink) => dataLink.oneClick === true);

    if (isPinned || hasOneClickLink) {
      const yFieldFrame = data.find((frame) => frame.fields.includes(yField))!;
      const actions = getFieldActions(yFieldFrame, yField, replaceVariables, rowIndex);

      footer = <VizTooltipFooter dataLinks={dataLinks} actions={actions} />;
    }
  }

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent items={contentItems} isPinned={isPinned} />
      {footer}
    </VizTooltipWrapper>
  );
};
