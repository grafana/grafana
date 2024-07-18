import { DataFrame, getFieldDisplayName, getFieldSeriesColor } from '@grafana/data';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import { VizLayoutLegendProps } from '../VizLayout/VizLayout';
import { getDisplayValuesForCalcs } from '../uPlot/utils';

import { VizLegend } from './VizLegend';

interface LegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
}

export const VizLegend2 = ({ data, placement, calcs, displayMode, ...vizLayoutLegendProps }: LegendProps) => {
  const theme = useTheme2();

  const items = data.map((frame) => {
    const field = frame.fields[1];
    const fieldIndex = field.state?.origin;

    const disabled = (field.config.custom?.hideFrom?.viz || field.state?.hideFrom?.viz) ?? false;
    const label = getFieldDisplayName(field, frame, data);
    const color = getFieldSeriesColor(field, theme).color;
    const yAxis = field.config.custom?.axisPlacement === AxisPlacement.Right ? 2 : 1;
    const lineStyle = field.config.custom?.lineStyle;

    return {
      disabled,
      fieldIndex, // IHOR: { frameIndex, fieldIndex } - it's only used in getItemKey
      label,
      color,
      yAxis,
      getDisplayValues: () => getDisplayValuesForCalcs(calcs, field, theme),
      // IHOR: getItemKey used in List component to assign a `key` to the item
      getItemKey: () => `${label}-${fieldIndex?.frameIndex}-${fieldIndex?.fieldIndex}`,
      lineStyle,
    };
  });

  return (
    <VizLegend
      placement={placement}
      items={items}
      displayMode={displayMode}
      sortBy={vizLayoutLegendProps.sortBy}
      sortDesc={vizLayoutLegendProps.sortDesc}
      isSortable={true}
    />
  );
};
