import { memo } from 'react';

import { Field, cacheFieldDisplayNames, DataFrame, FieldType, getFieldSeriesColor } from '@grafana/data';
import { AxisPlacement, VizLegendOptions } from '@grafana/schema';
import { useTheme2, VizLayout, VizLayoutLegendProps, VizLegend, VizLegendItem } from '@grafana/ui';
import { getDisplayValuesForCalcs } from '@grafana/ui/internal';

interface BarGaugeLegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  colorField?: Field | null;
}

export const BarGaugeLegend = memo(
  ({ data, placement, calcs, displayMode, ...vizLayoutLegendProps }: BarGaugeLegendProps) => {
    const theme = useTheme2();
    let legendItems: VizLegendItem[] = [];

    cacheFieldDisplayNames(data);

    data.forEach((series, frameIndex) => {
      series.fields.forEach((field, i) => {
        const fieldIndex = i + 1;

        if (field.type === FieldType.time || field.config.custom?.hideFrom?.legend) {
          return;
        }

        const label = field.state?.displayName ?? field.name;
        const color = getFieldSeriesColor(field, theme).color;

        const item: VizLegendItem = {
          label: label.toString(),
          color,
          yAxis: field.config.custom?.axisPlacement === AxisPlacement.Right ? 2 : 1,
          disabled: field.state?.hideFrom?.viz,
          getDisplayValues: () => getDisplayValuesForCalcs(calcs, field, theme),
          getItemKey: () => `${label}-${frameIndex}-${fieldIndex}`,
        };

        legendItems.push(item);
      });
    });

    return (
      <VizLayout.Legend placement={placement} {...vizLayoutLegendProps}>
        <VizLegend
          placement={placement}
          items={legendItems}
          displayMode={displayMode}
          sortBy={vizLayoutLegendProps.sortBy}
          sortDesc={vizLayoutLegendProps.sortDesc}
          isSortable={true}
        />
      </VizLayout.Legend>
    );
  }
);

BarGaugeLegend.displayName = 'BarGaugeLegend';
