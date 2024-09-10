import { memo } from 'react';

import { DataFrame, Field, FieldColorModeId, getFieldSeriesColor, ValueMapping } from '@grafana/data';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';
import { UPlotConfigBuilder, VizLayout, VizLayoutLegendProps, VizLegend, VizLegendItem, useTheme2 } from '@grafana/ui';
import { getDisplayValuesForCalcs } from '@grafana/ui/src/components/uPlot/utils';
// import { getFieldLegendItem } from 'app/core/components/TimelineChart/utils';
import { getThresholdItems, getValueMappingItems } from 'app/core/components/TimelineChart/utils';
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

    const fieldConfig = data[0].fields[0].config;
    const colorMode = fieldConfig.color?.mode;

    let thresholdItems: VizLegendItem[] = [];
    if (colorMode === FieldColorModeId.Thresholds) {
      for (let i = 0; i < data[0].fields.length; i++) {
        const thresholds = data[0].fields[i].config.thresholds;
        if (thresholds) {
          // in case of multiple fields, each field has same thresholds config as in first field (data[0].field[0].config),
          // so we need to avoid duplicates;
          // it is the same object, so we can compare by reference;
          // i === 0 is needed to add thresholds from the first field
          if ((i === 0 || fieldConfig.thresholds !== thresholds) && thresholds.steps.length > 1) {
            const config = data[0].fields[i].config;
            const items = getThresholdItems(config, theme);
            thresholdItems.push(...items);
          }
        }
      }
    }

    const mappings: ValueMapping[] = [];
    for (let i = 0; i < data[0].fields.length; i++) {
      const mapping = data[0].fields[i].config.mappings;
      if (mapping) {
        if (i === 0 || fieldConfig.mappings !== mapping) {
          mappings.push(...mapping);
        }
      }
    }
    const valueMappingItems: VizLegendItem[] = getValueMappingItems(mappings, theme);

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
          thresholdItems={thresholdItems}
          mappingItems={valueMappingItems}
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
