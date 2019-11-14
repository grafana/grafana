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
  TimeZone,
  hasMsResolution,
  MS_DATE_TIME_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
} from '@grafana/data';

import { SeriesOptions, GraphOptions } from './types';
import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';

export const getGraphSeriesModel = (
  dataFrames: DataFrame[],
  timeZone: TimeZone,
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

        let seriesColor;
        if (seriesOptions[field.name] && seriesOptions[field.name].color) {
          // Case when panel has settings provided via SeriesOptions, i.e. graph panel
          seriesColor = getColorFromHexRgbOrName(seriesOptions[field.name].color);
        } else if (field.config && field.config.color) {
          // Case when color settings are set on field, i.e. Explore logs histogram (see makeSeriesForLogs)
          seriesColor = field.config.color;
        } else {
          seriesColor = colors[graphs.length % colors.length];
        }

        field.config = fieldOptions
          ? {
              ...field.config,
              unit: fieldOptions.defaults.unit,
              decimals: fieldOptions.defaults.decimals,
              color: seriesColor,
            }
          : { ...field.config, color: seriesColor };

        field.display = getDisplayProcessor({ config: { ...field.config }, type: field.type });

        // Time step is used to determine bars width when graph is rendered as bar chart
        const timeStep = getSeriesTimeStep(timeField);
        const useMsDateFormat = hasMsResolution(timeField);

        timeField.display = getDisplayProcessor({
          type: timeField.type,
          isUtc: timeZone === 'utc',
          config: {
            dateDisplayFormat: useMsDateFormat ? MS_DATE_TIME_FORMAT : DEFAULT_DATE_TIME_FORMAT,
          },
        });

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
