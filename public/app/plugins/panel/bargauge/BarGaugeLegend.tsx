import { memo } from 'react';

import { DataFrame, getFieldSeriesColor, outerJoinDataFrames } from '@grafana/data';
import { Field } from '@grafana/data/';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';
import { VizLayout, VizLayoutLegendProps, VizLegend, VizLegendItem, useTheme2 } from '@grafana/ui';
import { getDisplayValuesForCalcs } from '@grafana/ui/src/components/uPlot/utils';

interface BarGaugeLegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  colorField?: Field | null;
}

export const BarGaugeLegend = memo(
  ({ data, placement, calcs, displayMode, ...vizLayoutLegendProps }: BarGaugeLegendProps) => {
    const theme = useTheme2();

    const alignedDataFrames = outerJoinDataFrames({ frames: data });

    let legendItems: VizLegendItem[] = [];

    if (alignedDataFrames && alignedDataFrames.fields.length > 0) {
      legendItems = alignedDataFrames.fields
        .map((field, i) => {
          const frameIndex = 0;
          const fieldIndex = i + 1;

          if (!field || field.type === 'time' || field.config.custom?.hideFrom?.legend) {
            return undefined;
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

          return item;
        })
        .filter((i): i is VizLegendItem => i !== undefined);
    }

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
