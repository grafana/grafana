import { DataFrame, DataFrameFieldIndex, TimeZone } from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, UPlotConfigBuilder } from '@grafana/ui';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ExemplarMarker } from './ExemplarMarker';
import uPlot from 'uplot';
import { HeatmapData } from '../fields';
import { HeatmapLookup } from '../types';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  timeZone: TimeZone;
  getValuesInCell: (lookupRange: HeatmapLookup) => DataFrame[] | undefined;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone, getValuesInCell, config }) => {
  const plotInstance = useRef<uPlot>();
  useLayoutEffect(() => {
    config.addHook('init', (u: uPlot) => {
      plotInstance.current = u;
    });
  }, [config]);

  const mapExemplarToXYCoords = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      const xMin = dataFrame.fields.find((f) => f.name === 'xMin');
      const yMin = dataFrame.fields.find((f) => f.name === 'yMin');
      const count = dataFrame.fields.find((f) => f.name === 'count');

      if (!xMin || !yMin || !count || !plotInstance.current) {
        return undefined;
      }

      // Don't render a merker if the count is zero
      if (!count.values.get(dataFrameFieldIndex.fieldIndex)) {
        return undefined;
      }

      // Filter x, y scales out
      const yScale = Object.keys(plotInstance.current.scales).find((scale) => 'y' === scale) ?? FIXED_UNIT;
      const xScale = Object.keys(plotInstance.current.scales).find((scale) => 'x' === scale) ?? FIXED_UNIT;
      const yEnd = plotInstance.current.scales[yScale].max;
      const yStart = plotInstance.current.scales[yScale].min;
      const xEnd = plotInstance.current.scales[xScale].max;
      const xStart = plotInstance.current.scales[xScale].min;

      if (
        xStart != null &&
        xEnd != null &&
        yStart != null &&
        yEnd != null &&
        exemplars.xBucketSize &&
        exemplars.yBucketSize
      ) {
        let x = xMin.values.get(dataFrameFieldIndex.fieldIndex) + exemplars.xBucketSize / 2;
        let y = yMin.values.get(dataFrameFieldIndex.fieldIndex) + exemplars.yBucketSize / 2;

        if (x < xStart || x > xEnd) {
          return undefined;
        }

        if (y < yStart || y > yEnd) {
          return undefined;
        }

        return {
          x: Math.round(plotInstance.current.valToPos(x, 'x')),
          y: Math.round(plotInstance.current.valToPos(y, 'y')),
        };
      }

      return undefined;
    },
    [exemplars]
  );

  const renderMarker = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      const xMin: number | undefined = dataFrame.fields
        .find((f) => f.name === 'xMin')
        ?.values.get(dataFrameFieldIndex.fieldIndex);
      const yMin: number | undefined = dataFrame.fields
        .find((f) => f.name === 'yMin')
        ?.values.get(dataFrameFieldIndex.fieldIndex);
      const count: number | undefined = dataFrame.fields
        .find((f) => f.name === 'count')
        ?.values.get(dataFrameFieldIndex.fieldIndex);
      return (
        xMin != null &&
        yMin != null &&
        count != null &&
        exemplars.xBucketSize != null &&
        exemplars.yBucketSize != null && (
          <ExemplarMarker
            timeZone={timeZone}
            getValuesInCell={getValuesInCell}
            lookupRange={{
              xRange: {
                min: xMin,
                max: xMin + exemplars.xBucketSize,
                delta: exemplars.xBucketSize || 0,
              },
              yRange: {
                min: yMin,
                max: yMin + exemplars.yBucketSize,
                delta: exemplars.yBucketSize || 0,
              },
              count,
            }}
            config={config}
          />
        )
      );
    },
    [config, timeZone, getValuesInCell, exemplars]
  );

  return (
    <EventsCanvas
      config={config}
      id="heatmap-exemplars"
      events={[exemplars.heatmap!]}
      renderEventMarker={renderMarker}
      mapEventToXYCoords={mapExemplarToXYCoords}
    />
  );
};
