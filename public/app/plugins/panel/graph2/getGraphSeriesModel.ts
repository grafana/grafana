import { colors, getFlotPairs, getColorFromHexRgbOrName, getDisplayProcessor } from '@grafana/ui';
import {
  NullValueMode,
  reduceField,
  FieldType,
  DisplayValue,
  GraphSeriesXY,
  getTimeField,
  DataFrame,
} from '@grafana/data';

import { SeriesOptions, GraphOptions } from './types';
import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';

export const getGraphSeriesModel = (
  dataFrames: DataFrame[],
  seriesOptions: SeriesOptions,
  graphOptions: GraphOptions,
  legendOptions: GraphLegendEditorLegendOptions
) => {
  const graphs: GraphSeriesXY[] = [];

  const displayProcessor = getDisplayProcessor({
    config: {
      decimals: legendOptions.decimals,
    },
  });

  for (const series of dataFrames) {
    const { timeField } = getTimeField(series);
    if (!timeField) {
      continue;
    }

    for (const field of series.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }

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

        graphs.push({
          label: field.name,
          data: points,
          color: seriesColor,
          info: statsDisplayValues,
          isVisible: true,
          yAxis: {
            index: (seriesOptions[field.name] && seriesOptions[field.name].yAxis) || 1,
          },
        });
      }
    }
  }

  return graphs;
};
