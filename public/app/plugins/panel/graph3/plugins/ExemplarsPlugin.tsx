import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrayVector,
  DataFrame,
  dateTimeFormat,
  FieldType,
  MutableDataFrame,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { Axis, EventsCanvas, Scale, usePlotContext, usePlotPluginContext } from '@grafana/ui';
import { ExemplarMarker } from './ExemplarMarker';

interface ExemplarsPluginProps {
  exemplars: DataFrame[];
  data: DataFrame[];
  timeZone: TimeZone;
}

// Type representing exemplars data frame fields
interface ExemplarsDataFrameViewDTO {
  time: number;
  y: number;
  text: string;
  tags: string[];
}

export const ExemplarsPlugin: React.FC<ExemplarsPluginProps> = ({ exemplars, timeZone }) => {
  const plotCtx = usePlotContext();
  const pluginId = 'ExemplarsPlugin';
  const exemplarsScaleKey = 'scale-exemplars';
  const pluginsApi = usePlotPluginContext();

  // TEMPORARY MOCK
  const [exemplarsMock, setExemplarsMock] = useState<DataFrame[]>([]);
  const exemplarsMinMaxMock = useRef<[number, number]>();

  useEffect(() => {
    const unregister = pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        // set exemplars scale range manually due to bug reported in https://github.com/leeoniya/uPlot/issues/334
        setScale: (u, key) => {
          if (key === exemplarsScaleKey && exemplarsMinMaxMock.current) {
            u.scales[key].min = exemplarsMinMaxMock.current[0];
            u.scales[key].max = exemplarsMinMaxMock.current[1];
          }
        },
      },
    });

    return () => {
      unregister();
    };
  }, []);

  useEffect(() => {
    // TODO: get min/max value from exemplars dataframe
    exemplarsMinMaxMock.current = [0, 100];
  }, [exemplarsMinMaxMock]);

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

  // THIS EVENT ONLY MOCKS EXEMPLAR Y VALUE!!!! TO BE REMOVED WHEN WE GET CORRECT EXEMPLARS SHAPE VIA PROPS
  useEffect(() => {
    if (plotCtx.isPlotReady) {
      const mocks: DataFrame[] = [];

      for (const frame of exemplars) {
        const mock = new MutableDataFrame(frame);
        mock.addField({
          name: 'y',
          type: FieldType.number,
          values: new ArrayVector(
            Array(frame.length)
              .fill(0)
              .map(() => Math.random())
          ),
        });
        mocks.push(mock);
      }

      setExemplarsMock(mocks);
    }
  }, [plotCtx.isPlotReady, exemplars]);

  const mapExemplarToXYCoords = useCallback(
    (exemplar: ExemplarsDataFrameViewDTO) => {
      if (!exemplar.time) {
        return undefined;
      }

      return {
        x: plotCtx.getPlotInstance().valToPos(exemplar.time / 1000, 'x'),
        // exemplar.y is a temporary mock for an examplar. This Needs to be calculated according to examplar scale!
        y: Math.floor((exemplar.y * plotCtx.getPlotInstance().bbox.height) / window.devicePixelRatio),
      };
    },
    [plotCtx.getPlotInstance]
  );

  const renderMarker = useCallback(
    (exemplar: ExemplarsDataFrameViewDTO) => {
      return <ExemplarMarker time={timeFormatter(exemplar.time)} text={exemplar.text} tags={exemplar.tags} />;
    },
    [timeFormatter]
  );

  return (
    <>
      <EventsCanvas<ExemplarsDataFrameViewDTO>
        id="exemplars"
        events={exemplarsMock}
        renderEventMarker={renderMarker}
        mapEventToXYCoords={mapExemplarToXYCoords}
      />
      <Scale scaleKey={exemplarsScaleKey} />
      <Axis scaleKey={exemplarsScaleKey} side={1} size={60} grid={false} />
    </>
  );
};
