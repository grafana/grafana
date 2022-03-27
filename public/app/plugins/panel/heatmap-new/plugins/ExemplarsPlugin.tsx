import { DataFrame, DataFrameFieldIndex, Field, LinkModel, TimeZone } from '@grafana/data';
import { EventsCanvas, UPlotConfigBuilder } from '@grafana/ui';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ExemplarMarker } from './ExemplarMarker';
import uPlot from 'uplot';
import { HeatmapData } from '../fields';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: HeatmapData;
  timeZone: TimeZone;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone, getFieldLinks, config }) => {
  const plotInstance = useRef<uPlot>();
  // console.log('in exemplars plugin', exemplars);
  useLayoutEffect(() => {
    console.log('useLayoutEffect', config);
    config.addHook('init', (u: uPlot) => {
      console.log('init instance', u);
      plotInstance.current = u;
    });
    config.addHook('draw', (u: uPlot) => {
      console.log('draw hook called', u);
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

      // Filter x, y scales out
      // const yScale =
      //   Object.keys(plotInstance.current.scales).find((scale) => 'y' === scale) ?? FIXED_UNIT;

      // const yMax = plotInstance.current.scales[yScale].max;
      //console.log("layout", exemplars);
      if (exemplars.xBucketCount && exemplars.yBucketCount) {
        // let xIndex = Math.floor(dataFrameFieldIndex.fieldIndex / exemplars.yBucketCount);
        // let yIndex = dataFrameFieldIndex.fieldIndex % exemplars.yBucketCount;
        let xStart = xMin.values.get(dataFrameFieldIndex.fieldIndex);
        // let xEnd = xMin.values.get(dataFrameFieldIndex.fieldIndex + exemplars.yBucketCount);
        let yStart = yMin.values.get(dataFrameFieldIndex.fieldIndex);
        // let yEnd = yMin.values.get(dataFrameFieldIndex.fieldIndex + 1);

        let x = xStart; // + ((xEnd - xStart) / 2);
        let y = yStart; // + ((yEnd - yStart) / 2);
        // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
        // if (yMin != null && y < yMin) {
        //   y = yMin;
        // }
        // if (yMax != null && y > yMax) {
        //   y = yMax;
        // }

        // Don't render a merker if the count is zero
        if (!count.values.get(dataFrameFieldIndex.fieldIndex)) {
          return undefined;
        }

        //console.log("x", x, "y", y, "xEnd", xEnd, "xStart", xStart, "xDiff", xEnd - xStart, "yDiff", yEnd - yStart, "xIndex", xIndex, "yIndex", yIndex, "yMax", yMax);

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
      //console.log("rnderEventMarker", dataFrame, dataFrameFieldIndex);
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

  // console.log('We have exemplars', exemplars, config);
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
