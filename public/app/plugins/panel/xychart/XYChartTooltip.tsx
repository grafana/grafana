import { ReactNode } from 'react';

import { colorManipulator, DataFrame, Field, InterpolateFunction, LinkModel } from '@grafana/data';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  ColorIndicator,
  VizTooltipItem,
} from '@grafana/ui/internal';
import { ActionContext } from 'app/features/actions/analytics';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

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
  panelId?: number;
}

function stripSeriesName(fieldName: string, seriesName: string) {
  if (fieldName !== seriesName && fieldName.includes(' ')) {
    fieldName = fieldName.replace(seriesName, '').trim();
  }

  return fieldName;
}

function hideFromTooltip(field: Field) {
  return field.config.custom.hideFrom?.tooltip ?? false;
}

function getFieldName(field: Field) {
  return field.state?.displayName ?? field.name;
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
  panelId,
}: Props) => {
  const rowIndex = dataIdxs.find((idx) => idx !== null)!;

  const series = xySeries[seriesIdx! - 1];
  const xField = series.x.field;
  const yField = series.y.field;

  const sizeField = series.size.field;
  const colorField = series.color.field;

  let label = series.name.value;

  let seriesColor = colorField?.display?.(colorField.values[rowIndex]).color ?? series.color.fixed ?? '#fff';
  let fillOpacity = colorField?.config.custom?.fillOpacity;

  // TODO: skip this if seriesColor already has an alpha component, such as opacity-by-value or opacity gradient schemes
  if (fillOpacity != null) {
    seriesColor = colorManipulator.alpha(seriesColor, fillOpacity / 100);
  }

  const headerItem: VizTooltipItem = {
    label,
    value: '',
    color: seriesColor,
    colorIndicator: ColorIndicator.marker_md,
  };

  const contentItems: VizTooltipItem[] = [];
  const addedFields = new Set<Field>();

  if (!hideFromTooltip(xField)) {
    contentItems.push({
      label: stripSeriesName(getFieldName(xField), label),
      value: fmt(xField, xField.values[rowIndex]),
    });
    addedFields.add(xField);
  }

  if (!hideFromTooltip(yField)) {
    contentItems.push({
      label: stripSeriesName(getFieldName(yField), label),
      value: fmt(yField, yField.values[rowIndex]),
    });
    addedFields.add(yField);
  }

  // mapped fields for size/color
  if (sizeField != null && !addedFields.has(sizeField) && !hideFromTooltip(sizeField)) {
    contentItems.push({
      label: stripSeriesName(getFieldName(sizeField), label),
      value: fmt(sizeField, sizeField.values[rowIndex]),
    });
    addedFields.add(sizeField);
  }

  if (colorField != null && !addedFields.has(colorField) && !hideFromTooltip(colorField)) {
    contentItems.push({
      label: stripSeriesName(getFieldName(colorField), label),
      value: fmt(colorField, colorField.values[rowIndex]),
    });
    addedFields.add(colorField);
  }

  series._rest.forEach((field) => {
    if (!hideFromTooltip(field)) {
      contentItems.push({
        label: stripSeriesName(field.state?.displayName ?? field.name, label),
        value: fmt(field, field.values[rowIndex]),
      });
    }
  });

  let footer: ReactNode;

  if (seriesIdx != null) {
    const hasOneClickLink = dataLinks?.some((dataLink) => dataLink.oneClick === true);

    if (isPinned || hasOneClickLink) {
      const yFieldFrame = data.find((frame) => frame.fields.includes(yField))!;
      const actionInstrumentationContext: ActionContext = {
        visualizationType: 'xychart',
        panelId,
        dashboardUid: getDashboardSrv().getCurrent()?.uid,
      };
      const actions = getFieldActions(yFieldFrame, yField, replaceVariables, rowIndex, actionInstrumentationContext);

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
