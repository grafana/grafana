import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import uPlot from 'uplot';

import { DataFrame, Labels, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, TimeZone } from '@grafana/data';
import { FIXED_UNIT, EventsCanvas, UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: DataFrame[];
  timeZone: TimeZone;
  visibleSeries?: VisibleExemplarLabels;
  maxHeight?: number;
  maxWidth?: number;
}

export const ExemplarsPlugin = ({
  exemplars,
  timeZone,
  config,
  visibleSeries,
  maxHeight,
  maxWidth,
}: ExemplarsPluginProps) => {
  const plotInstance = useRef<uPlot>();

  const [lockedExemplarRowIndex, setLockedExemplarRowIndex] = useState<number | undefined>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });
  }, [config]);

  const mapExemplarToXYCoords = useCallback((dataFrame: DataFrame, rowIndex: number) => {
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

    let y = value.values[rowIndex];
    // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
    if (yMin != null && y < yMin) {
      y = yMin;
    }

    if (yMax != null && y > yMax) {
      y = yMax;
    }

    return {
      x: plotInstance.current.valToPos(time.values[rowIndex], 'x'),
      y: plotInstance.current.valToPos(y, yScale),
    };
  }, []);

  const renderMarker = useCallback(
    (dataFrame: DataFrame, rowIndex: number): ReactNode => {
      const showMarker = visibleSeries !== undefined ? showExemplarMarker(visibleSeries, dataFrame, rowIndex) : true;

      const markerColor =
        visibleSeries !== undefined ? getExemplarColor(dataFrame, rowIndex, visibleSeries) : undefined;

      if (!showMarker) {
        return <></>;
      }

      return (
        <ExemplarMarker
          setClickedRowIndex={setLockedExemplarRowIndex}
          clickedRowIndex={lockedExemplarRowIndex}
          timeZone={timeZone}
          dataFrame={dataFrame}
          frameIndex={0}
          rowIndex={rowIndex}
          config={config}
          exemplarColor={markerColor}
          maxHeight={maxHeight}
          maxWidth={maxWidth}
        />
      );
    },
    [visibleSeries, lockedExemplarRowIndex, timeZone, config, maxHeight, maxWidth]
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

export type VisibleExemplarLabels = { labels: LabelWithExemplarUIData[]; totalSeriesCount: number };
/**
 * Get labels that are currently visible/active in the legend
 */
export const getVisibleLabels = (config: UPlotConfigBuilder, frames: DataFrame[] | null): VisibleExemplarLabels => {
  const visibleSeries = config.series.filter((series) => series.props.show);
  const visibleLabels: LabelWithExemplarUIData[] = [];
  if (frames?.length) {
    visibleSeries.forEach((plotInstance) => {
      const frameIndex = plotInstance.props?.dataFrameFieldIndex?.frameIndex;
      const fieldIndex = plotInstance.props?.dataFrameFieldIndex?.fieldIndex;

      if (frameIndex !== undefined && fieldIndex !== undefined) {
        const field = frames[frameIndex]?.fields[fieldIndex];
        if (field?.labels) {
          // Note that this may be an empty object in the case of a metric being rendered with no labels
          visibleLabels.push({
            labels: field.labels,
            color: plotInstance.props?.lineColor ?? '',
          });
        }
      }
    });
  }

  return { labels: visibleLabels, totalSeriesCount: config.series.length };
};

interface LabelWithExemplarUIData {
  labels: Labels;
  color?: string;
}

/**
 * Get color of active series in legend
 */
const getExemplarColor = (dataFrame: DataFrame, rowIndex: number, visibleLabels: VisibleExemplarLabels) => {
  let exemplarColor;
  visibleLabels.labels.some((visibleLabel) => {
    const labelKeys = Object.keys(visibleLabel.labels);
    const fields = dataFrame.fields.filter((field) => {
      return labelKeys.find((labelKey) => labelKey === field.name);
    });
    if (fields.length) {
      const hasMatch = fields.every((field, index, fields) => {
        const value = field.values[rowIndex];
        return visibleLabel.labels[field.name] === value;
      });

      if (hasMatch) {
        exemplarColor = visibleLabel.color;
        return true;
      }
    }
    return false;
  });
  return exemplarColor;
};

/**
 * Determine if the current exemplar marker is filtered by what series are selected in the legend UI
 */
const showExemplarMarker = (visibleSeries: VisibleExemplarLabels, dataFrame: DataFrame, rowIndex: number) => {
  let showMarker = false;
  // If all series are visible, don't filter any exemplars
  if (visibleSeries.labels.length === visibleSeries.totalSeriesCount) {
    showMarker = true;
  } else {
    visibleSeries.labels.some((visibleLabel) => {
      // Get the label names
      const labelKeys = Object.keys(visibleLabel.labels);

      // If there aren't any labels, the graph is only displaying a single series with exemplars, let's show all exemplars in this case as well
      if (Object.keys(visibleLabel.labels).length === 0) {
        showMarker = true;
      } else {
        // If there are labels, lets only show the exemplars with labels associated with series that are currently visible
        const fields = dataFrame.fields.filter((field) => {
          return labelKeys.find((labelKey) => labelKey === field.name);
        });

        if (fields.length) {
          // Check to see if at least one value matches each field
          showMarker = visibleSeries.labels.some((series) => {
            return Object.keys(series.labels).every((label) => {
              const value = series.labels[label];
              return fields.find((field) => field.values[rowIndex] === value);
            });
          });
        }
      }
      return showMarker;
    });
  }
  return showMarker;
};
