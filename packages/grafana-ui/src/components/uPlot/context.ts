import React, { useCallback, useContext } from 'react';
import uPlot, { Series } from 'uplot';
import { PlotPlugin, AlignedFrameWithGapTest } from './types';
import { DataFrame, Field, FieldConfig } from '@grafana/data';

interface PlotCanvasContextType {
  // canvas size css pxs
  width: number;
  height: number;
  // plotting area bbox, css pxs
  plot: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

interface PlotPluginsContextType {
  registerPlugin: (plugin: PlotPlugin) => () => void;
}

interface PlotContextType extends PlotPluginsContextType {
  isPlotReady: boolean;
  getPlotInstance: () => uPlot | undefined;
  getSeries: () => Series[];
  getCanvas: () => PlotCanvasContextType;
  canvasRef: any;
  data: AlignedFrameWithGapTest;
}

export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};

const throwWhenNoContext = (name: string) => {
  throw new Error(`${name} must be used within PlotContext or PlotContext is not ready yet!`);
};

// Exposes API for registering uPlot plugins
export const usePlotPluginContext = (): PlotPluginsContextType => {
  const ctx = useContext(PlotContext);
  if (Object.keys(ctx).length === 0) {
    throwWhenNoContext('usePlotPluginContext');
  }
  return {
    registerPlugin: ctx!.registerPlugin,
  };
};

// Exposes API for building uPlot config

interface PlotDataAPI {
  /** Data frame passed to graph, x-axis aligned */
  data: DataFrame;
  /** Returns field by index */
  getField: (idx: number) => Field;
  /** Returns x-axis fields */
  getXAxisFields: () => Field[];
  /** Returns x-axis fields */
  getYAxisFields: () => Field[];
  /** Returns field value by field and value index */
  getFieldValue: (fieldIdx: number, rowIdx: number) => any;
  /** Returns field config by field index */
  getFieldConfig: (fieldIdx: number) => FieldConfig;
}

export const usePlotData = (): PlotDataAPI => {
  const ctx = usePlotContext();

  const getField = useCallback(
    (idx: number) => {
      if (!ctx) {
        throwWhenNoContext('usePlotData');
      }
      return ctx!.data.frame.fields[idx];
    },
    [ctx]
  );

  const getFieldConfig = useCallback(
    (idx: number) => {
      const field: Field = getField(idx);
      return field.config;
    },
    [ctx]
  );

  const getFieldValue = useCallback(
    (fieldIdx: number, rowIdx: number) => {
      const field: Field = getField(fieldIdx);
      return field.values.get(rowIdx);
    },
    [ctx]
  );

  const getXAxisFields = useCallback(() => {
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return [getField(0)];
  }, [ctx]);

  const getYAxisFields = useCallback(() => {
    if (!ctx) {
      throwWhenNoContext('usePlotData');
    }
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return ctx!.data.frame.fields.slice(1);
  }, [ctx]);

  if (!ctx) {
    throwWhenNoContext('usePlotData');
  }

  return {
    data: ctx.data.frame,
    getField,
    getFieldValue,
    getFieldConfig,
    getXAxisFields,
    getYAxisFields,
  };
};

export const buildPlotContext = (
  isPlotReady: boolean,
  canvasRef: any,
  data: AlignedFrameWithGapTest,
  registerPlugin: any,
  getPlotInstance: () => uPlot | undefined
): PlotContextType => {
  return {
    isPlotReady,
    canvasRef,
    data,
    registerPlugin,
    getPlotInstance,
    getSeries: () => getPlotInstance()!.series,
    getCanvas: () => {
      const plotInstance = getPlotInstance()!;
      const bbox = plotInstance.bbox;
      const pxRatio = window.devicePixelRatio;
      return {
        width: plotInstance.width,
        height: plotInstance.height,
        plot: {
          width: bbox.width / pxRatio,
          height: bbox.height / pxRatio,
          top: bbox.top / pxRatio,
          left: bbox.left / pxRatio,
        },
      };
    },
  };
};
