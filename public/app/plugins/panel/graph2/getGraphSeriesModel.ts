import {
  SeriesData,
  StatID,
  GraphSeriesXY,
  getFirstTimeField,
  FieldType,
  NullValueMode,
  calculateStats,
  colors,
  getFlotPairs,
  getColorFromHexRgbOrName,
} from '@grafana/ui';
import { SeriesOptions } from './types';

export const getGraphSeriesModel = (data: SeriesData[], stats: StatID[], seriesOptions: SeriesOptions) => {
  const graphs: GraphSeriesXY[] = [];

  for (const series of data) {
    const timeColumn = getFirstTimeField(series);
    if (timeColumn < 0) {
      continue;
    }

    for (let i = 0; i < series.fields.length; i++) {
      const field = series.fields[i];

      // Show all numeric columns
      if (field.type === FieldType.number) {
        // Use external calculator just to make sure it works :)
        const points = getFlotPairs({
          series,
          xIndex: timeColumn,
          yIndex: i,
          nullValueMode: NullValueMode.Null,
        });

        if (points.length > 0) {
          const seriesColor =
            seriesOptions[field.name] && seriesOptions[field.name].color
              ? getColorFromHexRgbOrName(seriesOptions[field.name].color)
              : colors[graphs.length % colors.length];
          graphs.push({
            label: field.name,
            data: points,
            color: seriesColor,
            stats: calculateStats({ series, stats, fieldIndex: i }),
            isVisible: true,
            useRightYAxis: seriesOptions[field.name] && !!seriesOptions[field.name].useRightYAxis,
          });
        }
      }
    }
  }

  return graphs;
};
