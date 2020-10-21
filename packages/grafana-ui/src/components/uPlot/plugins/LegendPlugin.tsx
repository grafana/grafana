import React from 'react';
import { GraphCustomFieldConfig, GraphLegend, LegendDisplayMode, LegendItem } from '../..';
import { usePlotData } from '../context';
import { FieldType, getColorForTheme, getFieldDisplayName } from '@grafana/data';
import { colors } from '../../../utils';
import { useTheme } from '../../../themes';

export type LegendPlacement = 'top' | 'bottom' | 'left' | 'right';

interface LegendPluginProps {
  placement: LegendPlacement;
  displayMode?: LegendDisplayMode;
}

export const LegendPlugin: React.FC<LegendPluginProps> = ({ placement, displayMode = LegendDisplayMode.List }) => {
  const { data } = usePlotData();
  const theme = useTheme();

  const legendItems: LegendItem[] = [];

  let seriesIdx = 0;

  for (let i = 0; i < data.fields.length; i++) {
    const field = data.fields[i];

    if (field.type === FieldType.time) {
      continue;
    }
    legendItems.push({
      color:
        field.config.color && field.config.color.fixedColor
          ? getColorForTheme(field.config.color.fixedColor, theme)
          : colors[seriesIdx],
      label: getFieldDisplayName(field, data),
      isVisible: true,
      //flot vs uPlot differences
      yAxis: (field.config.custom as GraphCustomFieldConfig)?.axis?.side === 1 ? 3 : 1,
    });
    seriesIdx++;
  }

  return (
    <GraphLegend
      placement={placement === 'top' || placement === 'bottom' ? 'under' : 'right'}
      items={legendItems}
      displayMode={displayMode}
    />
  );
};
