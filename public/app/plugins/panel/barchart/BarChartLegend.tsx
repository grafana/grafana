import { memo } from 'react';

import { DataFrame, Field, getFieldSeriesColor } from '@grafana/data';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';
import { UPlotConfigBuilder, VizLayout, VizLayoutLegendProps, VizLegend, VizLegendItem, useTheme2 } from '@grafana/ui';
import { getDisplayValuesForCalcs } from '@grafana/ui/src/components/uPlot/utils';
import { getFieldLegendItem } from 'app/core/components/TimelineChart/utils';

interface BarChartLegend2Props extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  colorField?: Field | null;
  // config: UPlotConfigBuilder;
}

/**
 * mostly duplicates logic in PlotLegend below :(
 *
 * @internal
 */
export function hasVisibleLegendSeries(config: UPlotConfigBuilder, data: DataFrame[]) {
  return data[0].fields.slice(1).some((field) => !Boolean(field.config.custom?.hideFrom?.legend));

  // return config.getSeries().some((s, i) => {
  //   const frameIndex = 0;
  //   const fieldIndex = i + 1;
  //   const field = data[frameIndex].fields[fieldIndex];
  //   return !Boolean(field.config.custom?.hideFrom?.legend);
  // });
}

export const BarChartLegend = memo(
  ({ data, placement, calcs, displayMode, colorField, ...vizLayoutLegendProps }: BarChartLegend2Props) => {
    const theme = useTheme2();

    if (colorField != null) {
      const items = getFieldLegendItem([colorField], theme);

      if (items?.length) {
        return (
          <VizLayout.Legend placement={placement}>
            <VizLegend placement={placement} items={items} displayMode={displayMode} />
          </VizLayout.Legend>
        );
      }
    }

    const legendItems = data[0].fields
      .slice(1)
      .map((field, i) => {
        const frameIndex = 0;
        const fieldIndex = i + 1;
        // const axisPlacement = config.getAxisPlacement(s.props.scaleKey); // TODO: this should be stamped on the field.config?
        // const field = data[frameIndex].fields[fieldIndex];

        if (!field || field.config.custom?.hideFrom?.legend) {
          return undefined;
        }

        // // apparently doing a second pass like this will take existing state.displayName, and if same as another one, appends counter
        // const label = getFieldDisplayName(field, data[0], data);
        const label = field.state?.displayName ?? field.name;

        const color = getFieldSeriesColor(field, theme).color;

        const item: VizLegendItem = {
          disabled: field.state?.hideFrom?.viz,
          color,
          label,
          yAxis: field.config.custom?.axisPlacement === AxisPlacement.Right ? 2 : 1,
          getDisplayValues: () => getDisplayValuesForCalcs(calcs, field, theme),
          getItemKey: () => `${label}-${frameIndex}-${fieldIndex}`,
        };

        return item;
      })
      .filter((i): i is VizLegendItem => i !== undefined);

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

BarChartLegend.displayName = 'BarChartLegend';
