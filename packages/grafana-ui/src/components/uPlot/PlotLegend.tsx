import { memo } from 'react';

import { DataFrame, getFieldDisplayName, getFieldSeriesColor } from '@grafana/data';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import { VizLayout, VizLayoutLegendProps } from '../VizLayout/VizLayout';
import { VizLegend } from '../VizLegend/VizLegend';
import { VizLegendItem } from '../VizLegend/types';

import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import { getDisplayValuesForCalcs } from './utils';

interface PlotLegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  config: UPlotConfigBuilder;
}

/**
 * mostly duplicates logic in PlotLegend below :(
 *
 * @internal
 */
export function hasVisibleLegendSeries(config: UPlotConfigBuilder, data: DataFrame[]) {
  return config.getSeries().some((s) => {
    const fieldIndex = s.props.dataFrameFieldIndex;

    if (!fieldIndex) {
      return false;
    }

    const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

    if (!field || field.config.custom?.hideFrom?.legend) {
      return false;
    }

    return true;
  });
}

export const PlotLegend = memo(
  ({ data, config, placement, calcs, displayMode, ...vizLayoutLegendProps }: PlotLegendProps) => {
    const theme = useTheme2();

    const alignedFrame = data[0]!;
    const cfgSeries = config.getSeries();

    const legendItems: VizLegendItem[] = alignedFrame.fields
      .map((field, i) => {
        if (i === 0 || field.config.custom?.hideFrom.legend) {
          return undefined;
        }

        const dataFrameFieldIndex = field.state?.origin!;

        const seriesConfig = cfgSeries.find(({ props }) => {
          const { dataFrameFieldIndex: dataFrameFieldIndexCfg } = props;

          return (
            dataFrameFieldIndexCfg?.frameIndex === dataFrameFieldIndex.frameIndex &&
            dataFrameFieldIndexCfg?.fieldIndex === dataFrameFieldIndex.fieldIndex
          );
        });

        let axisPlacement = AxisPlacement.Left;

        // there is a bit of a bug here. since we no longer add hidden fields to the uplot config
        // we cannot determine "auto" axis placement of hidden series
        // we can fix this in future by decoupling some things
        if (seriesConfig != null) {
          axisPlacement = config.getAxisPlacement(seriesConfig.props.scaleKey);
        } else {
          let fieldAxisPlacement = field.config.custom?.axisPlacement;

          // respect explicit non-auto placement
          if (fieldAxisPlacement !== AxisPlacement.Auto) {
            fieldAxisPlacement = fieldAxisPlacement;
          }
        }

        const label = field.state?.displayName ?? field.name;
        const scaleColor = getFieldSeriesColor(field, theme);
        const seriesColor = scaleColor.color;

        return {
          disabled: field.state?.hideFrom?.viz,
          fieldIndex: dataFrameFieldIndex,
          color: seriesColor,
          label,
          yAxis: axisPlacement === AxisPlacement.Left || axisPlacement === AxisPlacement.Bottom ? 1 : 2,
          getDisplayValues: () => getDisplayValuesForCalcs(calcs, field, theme),
          getItemKey: () => `${label}-${dataFrameFieldIndex.frameIndex}-${dataFrameFieldIndex.fieldIndex}`,
          lineStyle: field.config.custom.lineStyle,
        };
      })
      .filter((item) => item !== undefined);

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

PlotLegend.displayName = 'PlotLegend';
