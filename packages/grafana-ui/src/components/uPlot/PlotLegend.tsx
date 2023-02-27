import React from 'react';

import {
  DataFrame,
  DisplayProcessor,
  DisplayValue,
  fieldReducers,
  getDisplayProcessor,
  getFieldDisplayName,
  getFieldSeriesColor,
  reduceField,
  ReducerID,
} from '@grafana/data';
import { VizLegendOptions, AxisPlacement } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import { VizLayout, VizLayoutLegendProps } from '../VizLayout/VizLayout';
import { VizLegend } from '../VizLegend/VizLegend';
import { VizLegendItem } from '../VizLegend/types';

import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));

interface PlotLegendProps extends VizLegendOptions, Omit<VizLayoutLegendProps, 'children'> {
  data: DataFrame[];
  config: UPlotConfigBuilder;
}

export const PlotLegend: React.FC<PlotLegendProps> = React.memo(
  ({ data, config, placement, calcs, displayMode, ...vizLayoutLegendProps }) => {
    const theme = useTheme2();
    const legendItems = config
      .getSeries()
      .map<VizLegendItem | undefined>((s) => {
        const seriesConfig = s.props;
        const fieldIndex = seriesConfig.dataFrameFieldIndex;
        const axisPlacement = config.getAxisPlacement(s.props.scaleKey);

        if (!fieldIndex) {
          return undefined;
        }

        const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

        if (!field || field.config.custom?.hideFrom?.legend) {
          return undefined;
        }

        const label = getFieldDisplayName(field, data[fieldIndex.frameIndex]!, data);
        const scaleColor = getFieldSeriesColor(field, theme);
        const seriesColor = scaleColor.color;

        return {
          disabled: !(seriesConfig.show ?? true),
          fieldIndex,
          color: seriesColor,
          label,
          yAxis: axisPlacement === AxisPlacement.Left || axisPlacement === AxisPlacement.Bottom ? 1 : 2,
          getDisplayValues: () => {
            if (!calcs?.length) {
              return [];
            }

            const fmt = field.display ?? defaultFormatter;
            let countFormatter: DisplayProcessor | null = null;

            const fieldCalcs = reduceField({
              field,
              reducers: calcs,
            });

            return calcs.map<DisplayValue>((reducerId) => {
              const fieldReducer = fieldReducers.get(reducerId);
              let formatter = fmt;

              if (fieldReducer.id === ReducerID.diffperc) {
                formatter = getDisplayProcessor({
                  field: {
                    ...field,
                    config: {
                      ...field.config,
                      unit: 'percentunit',
                    },
                  },
                  theme,
                });
              }

              if (
                fieldReducer.id === ReducerID.count ||
                fieldReducer.id === ReducerID.changeCount ||
                fieldReducer.id === ReducerID.distinctCount
              ) {
                if (!countFormatter) {
                  countFormatter = getDisplayProcessor({
                    field: {
                      ...field,
                      config: {
                        ...field.config,
                        unit: 'none',
                      },
                    },
                    theme,
                  });
                }
                formatter = countFormatter;
              }

              return {
                ...formatter(fieldCalcs[reducerId]),
                title: fieldReducer.name,
                description: fieldReducer.description,
              };
            });
          },
          getItemKey: () => `${label}-${fieldIndex.frameIndex}-${fieldIndex.fieldIndex}`,
        };
      })
      .filter((i) => i !== undefined) as VizLegendItem[];

    return (
      <VizLayout.Legend placement={placement} {...vizLayoutLegendProps}>
        <VizLegend
          placement={placement}
          items={legendItems}
          displayMode={displayMode}
          sortBy={vizLayoutLegendProps.sortBy}
          sortDesc={vizLayoutLegendProps.sortDesc}
        />
      </VizLayout.Legend>
    );
  }
);

PlotLegend.displayName = 'PlotLegend';
