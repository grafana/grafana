import {
  DataFrame,
  DataFrameFieldIndex,
  Field,
  LinkModel,
  TimeZone,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, UPlotConfigBuilder } from '@grafana/ui';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ExemplarMarker } from './ExemplarMarker';
import uPlot from 'uplot';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: DataFrame[];
  timeZone: TimeZone;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone, getFieldLinks, config }) => {
  const plotInstance = useRef<uPlot>();
  console.log('in exemplars plugin', exemplars);
  useLayoutEffect(() => {
    console.log('useLayoutEffect', config);
    config.addHook('init', (u: uPlot) => {
      console.log('init instance', u);
      plotInstance.current = u;
    });
  }, [config]);

  const mapExemplarToXYCoords = useCallback((dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
    console.log('mapExemplarToXYCoords', dataFrame, dataFrameFieldIndex);
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

  const renderMarker = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      console.log('rendering marker', dataFrame, dataFrameFieldIndex);
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
    [config, timeZone, getFieldLinks]
  );

  console.log('We have exemplars', exemplars, config);
  return (
    <EventsCanvas
      config={config}
      id="heatmap-exemplars"
      events={exemplars}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
