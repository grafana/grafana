import {
  DataFrame,
  DataFrameFieldIndex,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, UPlotConfigBuilder, usePlotContext } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { AudibleMarker } from './AudibleMarker';
import appEvents from 'app/core/app_events';
import { AudiblePanelEvent } from 'app/types/events';

interface PluginProps {
  config: UPlotConfigBuilder;
  frames: DataFrame[];
}

export const AudiblePlugin: React.FC<PluginProps> = ({ frames, config }) => {
  const plotCtx = usePlotContext();
  const [audibleFieldIndex, setAudibleFieldIndex] = useState<DataFrameFieldIndex>({ frameIndex: 0, fieldIndex: 0 });

  useEffect(() => {
    const sub = appEvents.subscribe(AudiblePanelEvent, (event) => {
      setAudibleFieldIndex({ fieldIndex: event.payload.pointIndex, frameIndex: event.payload.seriesIndex });
    });
    return () => sub.unsubscribe();
  }, []);

  const mapExemplarToXYCoords = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      if (
        dataFrameFieldIndex.fieldIndex !== audibleFieldIndex.fieldIndex ||
        dataFrameFieldIndex.frameIndex !== audibleFieldIndex.frameIndex
      ) {
        return undefined;
      }
      const plotInstance = plotCtx.plot;
      const time = dataFrame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
      const value = dataFrame.fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);

      if (!time || !value || !plotInstance) {
        return undefined;
      }

      // Filter x, y scales out
      const yScale =
        Object.keys(plotInstance.scales).find((scale) => !['x', 'y'].some((key) => key === scale)) ?? FIXED_UNIT;

      let y = value.values.get(dataFrameFieldIndex.fieldIndex);
      return {
        x: plotInstance.valToPos(time.values.get(dataFrameFieldIndex.fieldIndex), 'x'),
        y: plotInstance.valToPos(y, yScale),
      };
    },
    [plotCtx, audibleFieldIndex]
  );

  const renderMarker = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      return <AudibleMarker dataFrame={dataFrame} dataFrameFieldIndex={dataFrameFieldIndex} config={config} />;
    },
    [config, audibleFieldIndex]
  );

  return (
    <EventsCanvas
      config={config}
      id="audible"
      events={frames}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
