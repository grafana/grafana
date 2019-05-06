import {
  GraphSeriesXY,
  NullValueMode,
  reduceField,
  colors,
  getFlotPairs,
  getColorFromHexRgbOrName,
  getDisplayProcessor,
  DisplayValue,
  PanelData,
  FieldCache,
  FieldType,
} from '@grafana/ui';
import { SeriesOptions, GraphOptions } from './types';
import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';

export const getGraphSeriesModel = (
  data: PanelData,
  seriesOptions: SeriesOptions,
  graphOptions: GraphOptions,
  legendOptions: GraphLegendEditorLegendOptions
) => {
  const graphs: GraphSeriesXY[] = [];

  const displayProcessor = getDisplayProcessor({
    field: {
      decimals: legendOptions.decimals,
    },
  });

  for (const series of data.series) {
    const fieldCache = new FieldCache(series.fields);
    const timeColumn = fieldCache.getFirstFieldOfType(FieldType.time);
    if (!timeColumn) {
      continue;
    }

    const numberFields = fieldCache.getFields(FieldType.number);
    for (let i = 0; i < numberFields.length; i++) {
      const field = numberFields[i];
      // Use external calculator just to make sure it works :)
      const points = getFlotPairs({
        series,
        xIndex: timeColumn.index,
        yIndex: field.index,
        nullValueMode: NullValueMode.Null,
      });

      if (points.length > 0) {
        const seriesStats = reduceField({
          series,
          reducers: legendOptions.stats,
          fieldIndex: field.index,
        });
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
          yAxis: (seriesOptions[field.name] && seriesOptions[field.name].yAxis) || 1,
        });
      }
    }
  }

  return graphs;
};
