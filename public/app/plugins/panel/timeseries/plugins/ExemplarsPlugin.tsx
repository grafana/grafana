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
  onSelect?: (range: { from: number; to: number }, values?: { min?: number; max?: number }) => void;
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
      onSelect({ from: selection.min, to: selection.max }, { min: selection.minY, max: selection.maxY });
    }
  }, [selection, onSelect]);

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      if (selection) {
        setSelection(null);
      }
      plotInstance.current = u;
      // Wrap all setSelect hooks to prevent them from firing if user is annotating
      const setSelectHooks = u.hooks.setSelect;

      if (setSelectHooks) {
        for (let i = 0; i < setSelectHooks.length; i++) {
          const hook = setSelectHooks[i];

          if (hook !== setSelect) {
            setSelectHooks[i] = (...args) => {
              hook!(...args);
            };
          }
        }
      }
    });

    const setSelect = (u: uPlot) => {
      const yKey = u.series[1].scale || 'y';
      setSelection({
        min: u.posToVal(u.select.left, 'x'),
        max: u.posToVal(u.select.left + u.select.width, 'x'),
        maxY: u.posToVal(u.select.top, yKey),
        minY: u.posToVal(u.select.top + u.select.height, yKey),
        bbox: {
          left: u.select.left,
          top: u.select.top,
          height: u.select.height,
          width: u.select.width,
        },
      });
    };

    if (enabledAutoBreakdowns) {
      config.addHook('setSelect', setSelect);

      config.addHook('drawAxes', (u) => {
        if (selection) {
          const yKey = u.series[1].scale || 'y';
          let left = u.valToPos(selection.min, 'x', true);
          let right = u.valToPos(selection.max, 'x', true);
          let top = u.valToPos(selection.maxY || 0, yKey, true);
          let bottom = u.valToPos(selection.minY || 0, yKey, true);
          u.ctx.save();
          u.ctx.fillStyle = 'rgba(255,120,8,0.4)';

          u.ctx.fillRect(left, top, right - left, bottom - top);
          u.ctx.restore();
        }
      });

      config.setCursor({
        drag: {
          x: true,
          y: true,
        },
      });
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
