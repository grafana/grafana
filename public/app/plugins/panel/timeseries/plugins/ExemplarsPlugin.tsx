import React, { useCallback, useLayoutEffect, useRef } from 'react';
import uPlot from 'uplot';

import {
  DataFrame,
  DataFrameFieldIndex,
  Field,
  Labels,
  LinkModel,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
  TimeZone,
} from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: DataFrame[];
  timeZone: TimeZone;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  visibleLabels: { labels: Labels[]; totalSeriesCount: number };
}

export const getVisibleLabels = (
  config: UPlotConfigBuilder,
  frames: DataFrame[] | null
): { labels: Labels[]; totalSeriesCount: number } => {
  const visibleSeries = config.series.filter((series) => series.props.show);
  const visibleLabels: Labels[] = [];
  if (frames?.length) {
    visibleSeries.forEach((plotInstance) => {
      const frameIndex = plotInstance.props?.dataFrameFieldIndex?.frameIndex;
      const fieldIndex = plotInstance.props?.dataFrameFieldIndex?.fieldIndex;

      if (frameIndex !== undefined && fieldIndex !== undefined) {
        const field = frames[frameIndex].fields[fieldIndex];
        if (field.labels) {
          // Note that this may be an empty object in the case of a metric being rendered with no labels
          visibleLabels.push(field.labels);
        }
      }
    });
  }

  return { labels: visibleLabels, totalSeriesCount: config.series.length };
};

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({
  exemplars,
  timeZone,
  getFieldLinks,
  config,
  visibleLabels,
}) => {
  const plotInstance = useRef<uPlot>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });
  }, [config]);

  const mapExemplarToXYCoords = useCallback((dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
    const time = dataFrame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
    const value = dataFrame.fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);

    if (!time || !value || !plotInstance.current) {
      return undefined;
    }

    // Filter x, y scales out
    const yScale =
      Object.keys(plotInstance.current.scales).find((scale) => !['x', 'y'].some((key) => key === scale)) ?? FIXED_UNIT;

    const yMin = plotInstance.current.scales[yScale].min;
    const yMax = plotInstance.current.scales[yScale].max;

    let y = value.values.get(dataFrameFieldIndex.fieldIndex);
    // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
    if (yMin != null && y < yMin) {
      y = yMin;
    }

    if (yMax != null && y > yMax) {
      y = yMax;
    }

    return {
      x: plotInstance.current.valToPos(time.values.get(dataFrameFieldIndex.fieldIndex), 'x'),
      y: plotInstance.current.valToPos(y, yScale),
    };
  }, []);

  // Merge values from objects with same props
  const getUniqueValuesFromLabels = (labels: Labels[]) => {
    const labelToSet: { [index: string]: Set<string> } = {};

    Object.values(labels).forEach((labelObject) => {
      return Object.keys(labelObject).forEach((labelName) => {
        const labelValue: string = labelObject[labelName];
        if (typeof labelToSet[labelName] === 'undefined') {
          labelToSet[labelName] = new Set<string>().add(labelValue);
        } else {
          labelToSet[labelName].add(labelValue);
        }
      });
    });

    return labelToSet;
  };

  const renderMarker = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      let showMarker = false;

      // If all series are visible, don't filter any exemplars
      if (visibleLabels.labels.length === visibleLabels.totalSeriesCount) {
        showMarker = true;
      } else {
        visibleLabels.labels.forEach((visibleLabel) => {
          const labelKeys = Object.keys(visibleLabel);
          const labelsAndUniqueValuesFromActiveFilters = getUniqueValuesFromLabels(visibleLabels.labels);

          // If there aren't any labels, the graph is only displaying a single series with exemplars, let's show all exemplars in this case as well
          if (Object.keys(visibleLabel).length === 0) {
            showMarker = true;
          } else {
            // If there are labels, lets only show the exemplars with labels associated with series that are currently visible
            const fields = dataFrame.fields.filter((field) => {
              return labelKeys.find((labelKey) => labelKey === field.name);
            });

            // Check to see if at least one value matches each field
            if (fields.length) {
              showMarker = fields.every((field) => {
                const value = field.values.get(dataFrameFieldIndex.fieldIndex);
                const allValues = labelsAndUniqueValuesFromActiveFilters[field.name];

                return [...allValues].includes(value);
              });
            }
          }
        });
      }

      if (!showMarker) {
        return <></>;
      }

      return (
        <ExemplarMarker
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
          dataFrame={dataFrame}
          dataFrameFieldIndex={dataFrameFieldIndex}
          config={config}
        />
      );
    },
    [config, timeZone, getFieldLinks, visibleLabels]
  );

  return (
    <EventsCanvas
      config={config}
      id="exemplars"
      events={exemplars}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
