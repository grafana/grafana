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
  getDisplayProcessor,
  LegendOptions,
} from '@grafana/ui';
import capitalize from 'lodash/capitalize';
import { SeriesOptions, GraphOptions } from './types';
import { StatDisplayValue } from '@grafana/ui/src/components/Legend/Legend';

export const getGraphSeriesModel = (
  data: SeriesData[],
  stats: StatID[],
  seriesOptions: SeriesOptions,
  graphOptions: GraphOptions,
  legendOptions: LegendOptions
) => {
  const graphs: GraphSeriesXY[] = [];

  const displayProcessor = getDisplayProcessor({
    decimals: legendOptions.decimals,
  });

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
          const seriesStats = calculateStats({ series, stats, fieldIndex: i });
          const statsDisplayValues = stats.map<StatDisplayValue>(stat => {
            const statDisplayValue = displayProcessor(seriesStats[stat]);

            return {
              ...statDisplayValue,
              text: `${capitalize(stat)}: ${statDisplayValue.text}`,
              statId: stat,
            };
          });

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
            useRightYAxis: seriesOptions[field.name] && !!seriesOptions[field.name].useRightYAxis,
          });
        }
      }
    }
  }

  return graphs;
};
