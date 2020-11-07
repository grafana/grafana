import React from 'react';
import { GraphCustomFieldConfig, GraphLegend, LegendDisplayMode, LegendItem } from '../..';
import { DataFrame, FieldType, getColorForTheme, getFieldDisplayName } from '@grafana/data';
import { colors } from '../../../utils';
import { useTheme } from '../../../themes';
import { LegendPlacement } from '../../Legend/Legend';

interface LegendPluginProps {
  placement: LegendPlacement;
  displayMode?: LegendDisplayMode;
  data: DataFrame;
}

export const LegendPlugin: React.FC<LegendPluginProps> = ({
  placement,
  data,
  displayMode = LegendDisplayMode.List,
}) => {
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

  return <GraphLegend placement={placement} items={legendItems} displayMode={displayMode} />;
};
