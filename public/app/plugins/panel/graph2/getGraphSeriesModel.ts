import { colors } from '@grafana/ui';
import {
  getFlotPairs,
  getDisplayProcessor,
  NullValueMode,
  reduceField,
  FieldType,
  DisplayValue,
  GraphSeriesXY,
  getTimeField,
  DataFrame,
  getSeriesTimeStep,
  TimeZone,
  hasMsResolution,
  systemDateFormats,
  FieldColor,
  FieldColorModeId,
  FieldConfigSource,
  getFieldDisplayName,
} from '@grafana/data';

import { SeriesOptions, GraphOptions, GraphLegendEditorLegendOptions } from './types';

export const getGraphSeriesModel = (
  dataFrames: DataFrame[],
  timeZone: TimeZone,
  seriesOptions: SeriesOptions,
  graphOptions: GraphOptions,
  legendOptions: GraphLegendEditorLegendOptions,
  fieldOptions?: FieldConfigSource
) => {
  const graphs: GraphSeriesXY[] = [];

  const displayProcessor = getDisplayProcessor({
    field: {
      config: {
        unit: fieldOptions?.defaults?.unit,
        decimals: legendOptions.decimals,
      },
    },
    timeZone,
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
        const seriesStats = reduceField({ field, reducers: legendOptions.stats || [] });
        let statsDisplayValues: DisplayValue[] = [];

        if (legendOptions.stats) {
          statsDisplayValues = legendOptions.stats.map<DisplayValue>(stat => {
            const statDisplayValue = displayProcessor(seriesStats[stat]);

            return {
              ...statDisplayValue,
              title: stat,
            };
          });
        }

        let color: FieldColor;
        if (seriesOptions[field.name] && seriesOptions[field.name].color) {
          // Case when panel has settings provided via SeriesOptions, i.e. graph panel
          color = {
            mode: FieldColorModeId.Fixed,
            fixedColor: seriesOptions[field.name].color,
          };
        } else if (field.config && field.config.color) {
          // Case when color settings are set on field, i.e. Explore logs histogram (see makeSeriesForLogs)
          color = field.config.color;
        } else {
          color = {
            mode: FieldColorModeId.Fixed,
            fixedColor: colors[graphs.length % colors.length],
          };
        }

        field.config = fieldOptions
          ? {
              ...field.config,
              unit: fieldOptions.defaults.unit,
              decimals: fieldOptions.defaults.decimals,
              color,
            }
          : { ...field.config, color };

        field.display = getDisplayProcessor({ field, timeZone });

        // Time step is used to determine bars width when graph is rendered as bar chart
        const timeStep = getSeriesTimeStep(timeField);
        const useMsDateFormat = hasMsResolution(timeField);

        timeField.display = getDisplayProcessor({
          timeZone,
          field: {
            ...timeField,
            type: timeField.type,
            config: {
              unit: systemDateFormats.getTimeFieldUnit(useMsDateFormat),
            },
          },
        });

        graphs.push({
          label: getFieldDisplayName(field, series, dataFrames),
          data: points,
          color: field.config.color?.fixedColor,
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
