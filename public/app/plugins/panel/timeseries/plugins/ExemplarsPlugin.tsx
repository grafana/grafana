import {
  DataFrame,
  DataFrameFieldIndex,
  Field,
  LinkModel,
  TimeZone,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { EventsCanvas, FIXED_UNIT, UPlotConfigBuilder, PlotSelection } from '@grafana/ui';
import React, { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { ExemplarMarker } from './ExemplarMarker';
import uPlot from 'uplot';

interface ExemplarsPluginProps {
  config: UPlotConfigBuilder;
  exemplars: DataFrame[];
  timeZone: TimeZone;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  onSelect?: (range: { from: number; to: number }) => void;
  enabledAutoBreakdowns?: boolean;
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({
  exemplars,
  timeZone,
  getFieldLinks,
  config,
  enabledAutoBreakdowns = false,
  onSelect,
}) => {
  const plotInstance = useRef<uPlot>();
  const [selection, setSelection] = useState<PlotSelection | null>(null);

  useEffect(() => {
    if (selection && onSelect) {
      onSelect({ from: selection.min, to: selection.max });
    }
  }, [selection, onSelect]);

  useEffect(() => {
    return () => {
      setSelection(null);
      plotInstance.current?.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    };
    //@ts-ignore
  }, []);

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      if (selection) {
        setSelection(null);
      }
      plotInstance.current = u;
    });

    if (enabledAutoBreakdowns) {
      config.addHook('setSelect', (u) => {
        setSelection({
          min: u.posToVal(u.select.left, 'x'),
          max: u.posToVal(u.select.left + u.select.width, 'x'),
          bbox: {
            left: u.select.left,
            top: 0,
            height: u.select.height,
            width: u.select.width,
          },
        });
      });

      config.addHook('drawAxes', (u) => {
        if (selection) {
          let left = u.valToPos(selection.min, 'x', true);
          let right = u.valToPos(selection.max, 'x', true);
          u.ctx.save();
          u.ctx.fillStyle = 'rgba(255,120,8,0.2)';
          u.ctx.fillRect(left, u.bbox.top, right - left, u.bbox.height);
          u.ctx.restore();
        }
      });

      // config.setCursor({
      //   drag: {
      //     x: true,
      //     y: true,
      //   },
      // });
    }
  }, [config, selection, enabledAutoBreakdowns]);

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

  const renderMarker = useCallback(
    (dataFrame: DataFrame, dataFrameFieldIndex: DataFrameFieldIndex) => {
      return (
        <ExemplarMarker
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
          dataFrame={dataFrame}
          dataFrameFieldIndex={dataFrameFieldIndex}
          config={config}
          enabledAutoBreakdowns={enabledAutoBreakdowns}
        />
      );
    },
    [config, timeZone, getFieldLinks, enabledAutoBreakdowns]
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
