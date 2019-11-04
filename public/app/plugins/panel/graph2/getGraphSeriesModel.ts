import { colors } from '@grafana/ui';
import {
  getFlotPairs,
  getColorFromHexRgbOrName,
  getDisplayProcessor,
  NullValueMode,
  reduceField,
  FieldType,
  DisplayValue,
  GraphSeriesXY,
  getTimeField,
  DataFrame,
  FieldDisplayOptions,
  getSeriesTimeStep,
} from '@grafana/data';

import { SeriesOptions, GraphOptions } from './types';
import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';

export const getGraphSeriesModel = (
  dataFrames: DataFrame[],
  seriesOptions: SeriesOptions,
  graphOptions: GraphOptions,
  legendOptions: GraphLegendEditorLegendOptions,
  fieldOptions?: FieldDisplayOptions
) => {
  const graphs: GraphSeriesXY[] = [];

  const displayProcessor = getDisplayProcessor({
    config: {
      decimals: legendOptions.decimals,
    },
  });

  let fieldColumnIndex = -1;
  for (const series of dataFrames) {
    const { timeField } = getTimeField(series);

    if (!timeField) {
      continue;
    }

    for (const field of series.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      // Storing index of series field for future inspection
      fieldColumnIndex++;

      // Use external calculator just to make sure it works :)
      const points = getFlotPairs({
        xField: timeField,
        yField: field,
        nullValueMode: NullValueMode.Null,
      });

      if (points.length > 0) {
        const seriesStats = reduceField({ field, reducers: legendOptions.stats });
        let statsDisplayValues: DisplayValue[];

        if (legendOptions.stats) {
          statsDisplayValues = legendOptions.stats.map<DisplayValue>(stat => {
            const statDisplayValue = displayProcessor(seriesStats[stat]);

            return {
              ...statDisplayValue,
              text: statDisplayValue.text,
              title: stat,
            };
          });
        }

        const seriesColor =
          seriesOptions[field.name] && seriesOptions[field.name].color
            ? getColorFromHexRgbOrName(seriesOptions[field.name].color)
            : colors[graphs.length % colors.length];

        field.config = fieldOptions
          ? {
              ...field.config,
              unit: fieldOptions.defaults.unit,
              decimals: fieldOptions.defaults.decimals,
              color: seriesColor,
            }
          : { ...field.config };

        field.display = getDisplayProcessor({ config: field.config });
        const timeStep = getSeriesTimeStep(timeField);

        graphs.push({
          label: field.name,
          data: points,
          color: seriesColor,
          info: statsDisplayValues,
          isVisible: true,
          yAxis: {
            index: (seriesOptions[field.name] && seriesOptions[field.name].yAxis) || 1,
          },
          // This index is used later on to retrieve appropriate series/time for X and Y axes
          seriesIndex: fieldColumnIndex,
          timeField: { ...timeField },
          valueField: { ...field },
          timeStep,
        });
      }
    }
  }

  return graphs;
};
