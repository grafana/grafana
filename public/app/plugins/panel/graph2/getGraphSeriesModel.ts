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
} from '@grafana/ui';

export const getGraphSeriesModel = (data: SeriesData[], stats: StatID[]) => {
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
          graphs.push({
            label: field.name,
            data: points,
            color: colors[graphs.length % colors.length],
            stats: calculateStats({ series, stats, fieldIndex: i }),
            isVisible: true,
          });
        }
      }
    }
  }

  return graphs;
};
