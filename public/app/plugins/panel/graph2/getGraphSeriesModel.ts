import {
  GraphSeriesXY,
  getFirstTimeField,
  FieldType,
  NullValueMode,
  calculateStats,
  colors,
  getFlotPairs,
  getColorFromHexRgbOrName,
  getDisplayProcessor,
  DisplayValue,
  PanelData,
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
    decimals: legendOptions.decimals,
  });

  for (const series of data.series) {
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
          const seriesStats = calculateStats({ series, stats: legendOptions.stats, fieldIndex: i });
          let statsDisplayValues;

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
  }

  return graphs;
};
